import React from 'react'
import Logo from '../ui/Logo'
import Navlink from '../ui/Navlink'
import Button from '../ui/Button'

const Navbar = () => {
  return (
    <nav className="bg-red-300 w-full flex justify-between items-center px-6 py-4">
      <div className="flex items-center gap-6">
        <Logo />
        <Navlink text="About Us" />
        <Navlink text="Contact" />
      </div>

      <div className="flex items-center gap-4">
        <Button text="Login" href='/login' />
        <Button text="Sign Up" href='/signup' />
      </div>
    </nav>
  )
}

export default Navbar