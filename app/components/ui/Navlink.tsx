import React from 'react'

interface NavlinkProps {
    text: string;
    href?: string;
}

const Navlink = ({ text, href }: NavlinkProps) => {
  return (
    <a className='transition duration-500 hover:text-red-700 hover:cursor-pointer' href={href}>{text}</a>
  )
}

export default Navlink