import React from 'react'

interface ButtonProps {
    text: string;
}

const Button = ({ text }: ButtonProps) => {
  return (
    <button className='p-3 bg-red-400 rounded'>{text}</button>
  )
}

export default Button