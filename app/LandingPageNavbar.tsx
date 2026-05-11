import React from "react";
import Logo from "./components/ui/Logo";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";

const LandingPageNavbar = () => {
  return (
    <nav className="bg-red-200 w-full flex justify-between items-center px-6 py-4">
      <div className="flex items-center gap-6">
        <Logo />
        <NavigationMenu viewport={false}>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink href="#">About Us</NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="#">Contact</NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <div className="flex items-center gap-4">
        <Button
          asChild
          variant="outline"
          className="bg-orange-50 text-orange-700 hover:bg-orange-700 hover:text-orange-50"
        >
          <a href="/login">Log In</a>
        </Button>
        <Button
          asChild
          variant="outline"
          className="bg-orange-50 text-orange-700 hover:bg-orange-700 hover:text-orange-50"
        >
          <a href="/signup">Sign Up</a>
        </Button>
      </div>
    </nav>
  );
};

export default LandingPageNavbar;
