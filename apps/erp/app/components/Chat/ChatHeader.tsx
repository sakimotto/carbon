import { ChatNavigation } from "./ChatNavigation";
import { ChatTitle } from "./ChatTitle";

export function ChatHeader() {
  return (
    <div className="flex items-center justify-center relative h-8">
      <ChatNavigation />
      <ChatTitle />
    </div>
  );
}
