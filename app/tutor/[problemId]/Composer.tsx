"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/app/components/ui/input-group";
import { Switch } from "@/app/components/ui/switch";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  disabled: boolean;
  /** solve only: lets the student flag this message as their final-answer
   * attempt, rather than the tutor's judge guessing it from phrasing. */
  isFinalAttempt: boolean;
  onFinalAttemptChange: (value: boolean) => void;
  showFinalAttemptToggle: boolean;
};

/** Message input for the tutoring chat. Enter sends; Shift+Enter inserts a newline. */
export default function Composer({
  value,
  onChange,
  onSend,
  disabled,
  isFinalAttempt,
  onFinalAttemptChange,
  showFinalAttemptToggle,
}: ComposerProps) {
  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
  }

  return (
    <InputGroup>
      {showFinalAttemptToggle && (
        <InputGroupAddon align="block-start" className="border-b">
          <Switch
            id="final-attempt-toggle"
            checked={isFinalAttempt}
            onCheckedChange={onFinalAttemptChange}
            disabled={disabled}
          />
          <label
            htmlFor="final-attempt-toggle"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            This is my final answer to the problem
          </label>
        </InputGroupAddon>
      )}
      <InputGroupTextarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Type your response…"
        disabled={disabled}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          onClick={submit}
          disabled={disabled || !value.trim()}
        >
          Send
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
