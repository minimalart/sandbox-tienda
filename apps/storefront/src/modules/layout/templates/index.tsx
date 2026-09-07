import Footer from "@modules/layout/templates/footer";
import Nav from "@modules/layout/templates/nav";
import CompareFloatingTray from "@modules/layout/components/compare-floating-tray";
import type React from "react";

const Layout: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div>
    <Nav />
    <main className="relative pb-24 lg:pb-0">{children}</main>
    <CompareFloatingTray />
    <Footer />
  </div>
);

export default Layout;
