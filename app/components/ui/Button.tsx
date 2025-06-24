import React from "react";

interface ButtonProps {
  text: string;
  href?: string;
}

const Button = ({ text, href }: ButtonProps) => {
  return (
    <a href={href}>
      <button className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
        {text}
      </button>
    </a>
  );
};

export default Button;
