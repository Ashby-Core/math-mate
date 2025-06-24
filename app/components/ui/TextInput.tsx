import React from "react";

interface TextInputProps {
    labelText: string;
    type: string;
    placeholder: string;
}

const TextInput = ({ labelText, type, placeholder }: TextInputProps) => {
  return (
    <div>
      <label
        htmlFor={labelText.toLowerCase()}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {labelText}
      </label>
      <input
        id={labelText.toLowerCase()}
        name={labelText.toLowerCase()}
        type={type}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
        placeholder={placeholder}
      />
    </div>
  );
};

export default TextInput;
