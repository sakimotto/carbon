import { Button } from "@carbon/react";
import { generateId } from "ai";
import { LuCirclePlus } from "react-icons/lu";
import { useUrlParams } from "~/hooks";

export function NewChat() {
  const [,setParams] = useUrlParams();

  const handleNewChat = () => {
    setParams({ chatId: generateId() });
  };

  return (
    <Button variant="secondary" isIcon onClick={handleNewChat}>
      <LuCirclePlus size={16} />
    </Button>
  );
}
