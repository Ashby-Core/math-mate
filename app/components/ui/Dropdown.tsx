import React from 'react'

interface DropdownProps {
    name: string;
    labelText: string;
    options: string[];
}

const Dropdown = ({ labelText, name, options }: DropdownProps) => {
  return (
    <div>
      <label htmlFor={name.toLowerCase()} className="block text-sm font-medium text-gray-700 mb-1">
        {labelText}
      </label>
      <select
        id={name}
        name={name}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 appearance-none"
      >
        <option value="" disabled className="text-gray-400">
          Select your demographic
        </option>
        {options.map((option) => <option key={option} value={option.toLowerCase()}>{option}</option>)}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
    </div>
  )
}

export default Dropdown