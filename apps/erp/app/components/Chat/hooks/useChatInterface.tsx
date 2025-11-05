import { useUrlParams } from "@carbon/remix";
import { useEffect, useState } from "react";

export function useChatInterface() {
  const [params, setParams] = useUrlParams();

  // Initialize state immediately from pathname to avoid blink on refresh
  const getInitialChatId = () => {
    return params.get("chatId") || null;
  };

  const [chatId, setChatIdState] = useState<string | null>(getInitialChatId);

  // Extract chatId from pathname
  useEffect(() => {
    setChatIdState(params.get("chatId") || null);
  }, [params]);

  

  const isHome = !chatId;
  const isChatPage = Boolean(chatId);

  const setChatId = (id: string) => {
    // Preserve the locale in the URL
    setParams({ chatId: id });
    setChatIdState(id);
  };

  return {
    isHome,
    isChatPage,
    chatId,
    setChatId,
  };
}
