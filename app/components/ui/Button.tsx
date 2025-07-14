import React from "react";

interface ButtonProps {
  text: string;
  href?: string;
}

const Button = ({ text, href }: ButtonProps) => {
  return (
    <a href={href}>
      <button >
        {text}
      </button>
    </a>
  );
};

export default Button;
