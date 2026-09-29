import type { ReactNode } from "react";

export function SiteShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`site-shell ${className}`}>
      <header className="site-header">
        <a href="https://ionwyn.com" aria-label="Ionwyn home">
          ionwyn<span className="brand-dot">.</span>
        </a>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <a
          href="https://github.com/ionwyn"
          target="_blank"
          rel="noopener noreferrer"
        >
          Designed &amp; Built by Ionwyn Sean
        </a>
      </footer>
    </div>
  );
}
