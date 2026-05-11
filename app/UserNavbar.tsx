import React from "react";
import Logo from "../public/Logo";
import { logout } from "@/app/actions/actions";
import { Button } from "@/app/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/app/components/ui/navigation-menu";

const UserNavbar = () => {
  return (
    <nav className="bg-red-200 w-full flex justify-between items-center px-6 py-4">
      <div className="flex items-center gap-6">
        <Logo />
        <NavigationMenu viewport={false}>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink href="#">Settings</NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="#">Contact</NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <div className="flex items-center gap-4">
        <form action={logout}>
          <Button
            type="submit"
            variant="outline"
            className="bg-orange-50 text-orange-700 hover:bg-orange-700 hover:text-orange-50"
          >
            Log Out
          </Button>
        </form>
      </div>
    </nav>
  );
};

export default UserNavbar;
