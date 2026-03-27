"use client";

/**
 * Real-time collaboration hook using Supabase Realtime.
 *
 * - Broadcasts slide edits to other users on the same presentation channel.
 * - Receives remote edits and applies them via Redux `updateSlide`.
 * - Shows presence avatars (who is viewing which slide).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { updateSlide } from "@/store/slices/presentationGeneration";
import { createClient } from "@/lib/supabase/client";

export interface PresenceEntry {
  user_id: string;
  name: string;
  color: string;
  slide_index: number;
  online_at: string;
}

const USER_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16",
];

function randomColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % USER_COLORS.length;
  }
  return USER_COLORS[Math.abs(h)];
}

export function useCollaboration(
  presentationId: string,
  currentSlide: number,
) {
  const dispatch = useDispatch();
  const channelRef = useRef<ReturnType<typeof createClient>["channel"] extends (c: string) => infer R ? R : never | null>(null as any);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Track whether we're the source of a given update (to avoid echo)
  const pendingBroadcasts = useRef(new Set<string>());

  useEffect(() => {
    isMounted.current = true;
    const supabase = createClient();
    const channelName = `presentation:${presentationId}`;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: "users" }, broadcast: { self: false } },
    });
    channelRef.current = channel as any;

    // Handle remote slide updates (broadcast)
    channel.on("broadcast", { event: "slide_update" }, ({ payload }: { payload: any }) => {
      if (!isMounted.current) return;
      if (payload?.slide) {
        dispatch(updateSlide({ index: payload.slide.index, slide: payload.slide }));
      }
    });

    // Handle presence state
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceEntry>();
        const entries: PresenceEntry[] = Object.values(state).flat();
        if (isMounted.current) setPresence(entries);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        // Track our own presence
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted.current) {
          setMyUserId(user.id);
          await channel.track({
            user_id: user.id,
            name: user.user_metadata?.full_name || user.email || "Anonymous",
            color: randomColor(user.id),
            slide_index: currentSlide,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [presentationId]);

  // Update presence when current slide changes
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user && isMounted.current) {
        channel.track({
          user_id: user.id,
          name: user.user_metadata?.full_name || user.email || "Anonymous",
          color: randomColor(user.id),
          slide_index: currentSlide,
          online_at: new Date().toISOString(),
        });
      }
    });
  }, [currentSlide]);

  // Call this whenever a local slide edit occurs
  const broadcastSlideUpdate = useCallback((slide: any) => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.send({
      type: "broadcast",
      event: "slide_update",
      payload: { slide },
    });
  }, []);

  return { presence, myUserId, broadcastSlideUpdate };
}
