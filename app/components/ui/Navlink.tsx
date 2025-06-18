import React from 'react'

interface NavlinkProps {
    text: string;
    href?: string;
}

const Navlink = ({ text, href }: NavlinkProps) => {
  return (
    <a href={href}>{text}</a>
  )
}

export default Navlink