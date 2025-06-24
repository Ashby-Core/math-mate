import React from "react";

interface FormButtonProps {
  text: string;
  formAction: (data: FormData) => void;
}

const FormButton = ({ text, formAction }: FormButtonProps) => {
  return (
    <button
      formAction={formAction}
      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
    >
      {text}
    </button>
  );
};

export default FormButton;
