"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/app/components/ui/input-group";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  disabled: boolean;
};

/** Message input for the tutoring chat. Enter sends; Shift+Enter inserts a newline. */
export default function Composer({
  value,
  onChange,
  onSend,
  disabled,
}: ComposerProps) {
  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
  }

  return (
    <InputGroup>
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
