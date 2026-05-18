'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { setCanChangeKeys, setLLMConfig } from '@/store/slices/userConfig';
import { hasValidLLMConfig } from '@/utils/storeHelpers';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { checkIfSelectedOllamaModelIsPulled } from '@/utils/providerUtils';
import { LLMConfig } from '@/types/llm_config';
import { Search } from 'lucide-react';

// Placeholder data for skeleton loading
const TAG_PLACEHOLDERS = ['', '', '', '', ''];
const CARD_PLACEHOLDERS = Array(5).fill(null);

// Skeleton component for template cards
function TemplateCardSkeleton({ isCreateCard }: { isCreateCard?: boolean }) {
  if (isCreateCard) {
    return (
      <div className="flex h-[280px] flex-col rounded-2xl border border-violet-200 bg-white/95 shadow-sm">
        <div className="flex h-40 items-center justify-center rounded-t-2xl bg-gradient-to-br from-violet-50 to-indigo-50">
          <div className="h-12 w-12 rounded-full bg-violet-100" />
        </div>
        <div className="flex flex-1 flex-col justify-between p-5">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-full rounded bg-slate-100" />
          <div className="mt-4 h-8 w-24 rounded-lg bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[280px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-40 rounded-t-2xl bg-slate-100" />
      <div className="flex flex-1 flex-col justify-between p-5">
        <div className="h-5 w-40 rounded bg-slate-200" />
        <div className="mt-2 h-3 w-full rounded bg-slate-100" />
        <div className="mt-2 h-3 w-3/4 rounded bg-slate-100" />
        <div className="mt-4 flex items-center justify-between">
          <div className="h-4 w-16 rounded bg-slate-200" />
          <div className="h-8 w-8 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-40 flex h-20 shrink-0 items-center justify-around border-t border-violet-100 bg-[#fbf9ff]/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur md:sticky md:top-0 md:h-screen md:w-[72px] md:flex-col md:justify-start md:border-r md:border-t-0 md:bg-[#fbf9ff] md:py-3 md:shadow-none"
      aria-label="Loading dashboard sidebar"
    >
      <div className="hidden h-9 w-9 rounded-lg bg-violet-200 md:mb-5 md:block" />

      <nav className="flex flex-1 items-center justify-around gap-2 md:w-full md:flex-none md:flex-col md:justify-start">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex w-[58px] flex-col items-center gap-1 rounded-xl px-1 py-2">
            <div className={`h-9 w-9 rounded-xl ${index === 0 ? 'bg-violet-200' : 'bg-slate-200'}`} />
            <div className="h-2 w-10 rounded bg-slate-200" />
          </div>
        ))}
      </nav>

      <div className="hidden items-center gap-3 md:mt-auto md:flex md:flex-col">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-9 w-9 rounded-xl bg-slate-200" />
        ))}
      </div>
    </aside>
  );
}

export function ConfigurationInitializer({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const route = usePathname();

  // Fetch user config state
  useEffect(() => {
    fetchUserConfigState();
  }, []);

  const setLoadingToFalseAfterNavigatingTo = (pathname: string) => {
    const interval = setInterval(() => {
      if (window.location.pathname === pathname) {
        clearInterval(interval);
        setIsLoading(false);
      }
    }, 500);
  };

  const checkIfSelectedCustomModelIsAvailable = async (llmConfig: LLMConfig) => {
    try {
      const response = await fetch('/api/v1/ppt/openai/models/available', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: llmConfig.CUSTOM_LLM_URL,
          api_key: llmConfig.CUSTOM_LLM_API_KEY,
        }),
      });
      const data = await response.json();
      return data.includes(llmConfig.CUSTOM_MODEL);
    } catch (error) {
      console.error('Error fetching custom models:', error);
      return false;
    }
  };

  const fetchUserConfigState = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/can-change-keys');
      const canChangeKeys = (await response.json()).canChange;
      dispatch(setCanChangeKeys(canChangeKeys));

      // SaaS / managed mode: API keys are configured centrally by admin.
      // Skip all key validation and let the user straight through.
      if (!canChangeKeys) {
        setIsLoading(false);
        return;
      }

      // Self-hosted mode: validate user-provided LLM config.
      const configResponse = await fetch('/api/user-config');
      const llmConfig = await configResponse.json();

      if (!llmConfig.LLM) {
        llmConfig.LLM = 'openai';
      }
      if (!llmConfig.IMAGE_PROVIDER) {
        llmConfig.IMAGE_PROVIDER = 'gpt-image-1.5';
      }

      dispatch(setLLMConfig(llmConfig));
      const isValid = hasValidLLMConfig(llmConfig);

      if (isValid) {
        if (llmConfig.LLM === 'ollama') {
          const isPulled = await checkIfSelectedOllamaModelIsPulled(llmConfig.OLLAMA_MODEL);
          if (!isPulled) {
            router.push('/');
            setLoadingToFalseAfterNavigatingTo('/');
            return;
          }
        }

        if (llmConfig.LLM === 'custom') {
          const isAvailable = await checkIfSelectedCustomModelIsAvailable(llmConfig);
          if (!isAvailable) {
            router.push('/');
            setLoadingToFalseAfterNavigatingTo('/');
            return;
          }
        }

        if (route === '/') {
          router.push('/upload');
          setLoadingToFalseAfterNavigatingTo('/upload');
        } else {
          setIsLoading(false);
        }
      } else if (route !== '/') {
        router.push('/');
        setLoadingToFalseAfterNavigatingTo('/');
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching user config:', error);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen animate-pulse flex-col bg-white font-syne text-slate-950 md:flex-row">
        <SidebarSkeleton />

        <div className="min-w-0 flex-1 pb-24 md:pb-0">
          <div className="rounded-b-[28px] bg-[linear-gradient(115deg,#b7f3ee_0%,#f9fbff_44%,#d7b6ff_100%)] px-6 pb-12 pt-14 md:px-10">
            <div className="mx-auto flex max-w-5xl flex-col items-center">
              <div className="h-12 w-80 max-w-full rounded-2xl bg-white/50" />
              <div className="relative mt-7 h-16 w-full max-w-3xl rounded-2xl border border-violet-200 bg-white/95 shadow-[0_18px_50px_rgba(124,58,237,0.12)]">
                <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
                <div className="ml-14 mt-6 h-3 w-48 rounded bg-slate-100" />
              </div>
            </div>
          </div>

          <main className="px-6 py-8 md:px-10">
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="h-7 w-56 rounded bg-slate-200" />
                <div className="h-3 w-20 rounded bg-slate-100" />
              </div>
            </section>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              {TAG_PLACEHOLDERS.map((tag, index) => (
                <div
                  key={`tag-${index}`}
                  className={`h-9 rounded-full ${
                    index === 0
                      ? "w-12 bg-slate-950"
                      : "w-28 border border-violet-200 bg-white"
                  }`}
                />
              ))}
            </div>

            <section className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <div className="h-7 w-80 max-w-full rounded bg-slate-200" />
                <div className="h-10 w-10 rounded-full border border-slate-200 bg-white shadow-sm" />
              </div>

              <div className="grid grid-cols-1 gap-6 pb-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <TemplateCardSkeleton isCreateCard />
                {CARD_PLACEHOLDERS.map((_, index) => (
                  <TemplateCardSkeleton key={`card-${index}`} />
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
