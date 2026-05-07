'use client';

import { useEffect, useState } from 'react';
import { setCanChangeKeys, setLLMConfig } from '@/store/slices/userConfig';
import { hasValidLLMConfig } from '@/utils/storeHelpers';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { checkIfSelectedOllamaModelIsPulled } from '@/utils/providerUtils';
import { LLMConfig } from '@/types/llm_config';

export function ConfigurationInitializer({ children }: { children: React.ReactNode }) {
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
  }

  const fetchUserConfigState = async () => {
    setIsLoading(true);
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
  }


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
  }


  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-6">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#7A5AF8] border-r-[#7A5AF8] animate-spin"></div>
              <div className="absolute inset-3 rounded-full bg-white shadow-sm"></div>
            </div>

            <div className="w-full space-y-3">
              <div className="mx-auto h-3 w-40 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-[#7A5AF8]"></div>
              </div>
              <div className="mx-auto h-2 w-56 rounded-full bg-slate-200 animate-pulse"></div>
              <div className="mx-auto h-2 w-36 rounded-full bg-slate-100 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
