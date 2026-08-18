import { Link } from "react-router-dom";

export const Footer = () => (
  <footer className="border-t border-border/40 py-10">
    <div className="container flex flex-col md:flex-row items-center justify-between gap-4 mono text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="text-scope">✧</span>
        <span className="select-text cursor-text">soundemote@gmail.com</span>
      </div>
      <div className="flex items-center gap-6">
        <Link to="/search" className="hover:text-scope transition-colors uppercase tracking-[0.2em]">search</Link>
        <Link to="/modules" className="hover:text-scope transition-colors uppercase tracking-[0.2em]">modules</Link>
        <Link to="/webring" className="hover:text-scope transition-colors uppercase tracking-[0.2em]">webring</Link>
        <a href="https://discord.gg/hjpBC8kZ3s" target="_blank" rel="noreferrer" className="hover:text-scope transition-colors uppercase tracking-[0.2em]">Discord</a>
      </div>
    </div>
  </footer>
);

export default Footer;

