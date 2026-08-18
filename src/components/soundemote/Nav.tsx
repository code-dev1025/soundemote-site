import { useEffect, useRef, useState } from "react";
import ShareProjectDialog from "./ShareProjectDialog";
import SiteSearch from "./SiteSearch";
import { useAuth } from "@/hooks/useAuth";
import soundemoteLogo from "@/assets/soundemote-logo.svg.asset.json";

type Burst = {
  id: number;
  aX: number;
  aY: number;
  bX: number;
  bY: number;
  cX: number;
  cY: number;
  dX: number;
  dY: number;
  eX: number;
  eY: number;
};

const zapJitter = () => Math.round((Math.random() - 0.5) * 20);

function SparkTilde({
  hovered,
  reserveWhenIdle = false,
}: {
  hovered: boolean;
  reserveWhenIdle?: boolean;
}) {
  const [visible, setVisible] = useState(!reserveWhenIdle);
  const [color, setColor] = useState(() => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 80%, 60%)`;
  });

  useEffect(() => {
    if (!hovered) return;
    let timeout = 0;
    const tick = () => {
      setVisible(Math.random() > (hovered ? 0.54 : 0.32));
      timeout = window.setTimeout(tick, hovered ? 35 + Math.random() * 170 : 280 + Math.random() * 1400);
    };
    timeout = window.setTimeout(tick, hovered ? 80 : 420);
    return () => window.clearTimeout(timeout);
  }, [hovered]);

  useEffect(() => {
    if (visible) {
      const hue = Math.floor(Math.random() * 360);
      setColor(`hsl(${hue}, 80%, 60%)`);
    }
  }, [visible]);

  return (
    <span
      style={{ color, opacity: visible ? 1 : 0 }}
      className="inline-block w-[1ch] transition-none"
    >
      ~
    </span>
  );
}

export function SandboxNavLink({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextBurstIdRef = useRef(0);
  const burstTimersRef = useRef<number[]>([]);

  const triggerBurst = () => {
    const id = nextBurstIdRef.current++;
    setBursts((active) => [
      ...active,
      {
        id,
        aX: zapJitter(),
        aY: zapJitter(),
        bX: zapJitter(),
        bY: zapJitter(),
        cX: zapJitter(),
        cY: zapJitter(),
        dX: zapJitter(),
        dY: zapJitter(),
        eX: zapJitter(),
        eY: zapJitter(),
      },
    ]);
    const timer = window.setTimeout(() => {
      setBursts((active) => active.filter((burst) => burst.id !== id));
    }, 1100);
    burstTimersRef.current.push(timer);
  };

  useEffect(
    () => () => {
      burstTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    },
    []
  );

  return (
    <a
      href={href}
      onMouseEnter={() => {
        setHovered(true);
        triggerBurst();
      }}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => {
        setHovered(true);
        triggerBurst();
      }}
      onBlur={() => setHovered(false)}
      className="sandbox-link group relative inline-flex min-w-max shrink-0 items-center whitespace-nowrap rounded-full px-2 py-1.5 mono normal-case text-[0.82rem] tracking-normal text-slate-300 outline-none transition-colors hover:text-slate-100 focus-visible:text-slate-100"
    >
      <SparkTilde hovered={hovered} reserveWhenIdle />
      <span className="min-w-max shrink-0 whitespace-nowrap">{label}</span>
      <SparkTilde hovered={hovered} />
      {bursts.map((burst) => (
        <span key={burst.id} aria-hidden className="sandbox-burst pointer-events-none absolute inset-0">
          <span
            style={{ left: `calc(8% + ${burst.aX}px)`, top: `calc(50% + ${burst.aY}px)` }}
            className="sandbox-bolt sandbox-bolt-a pointer-events-none absolute text-[0.68rem] text-[#ffe156] opacity-0"
          >
            ⚡︎
          </span>
          <span
            style={{ left: `calc(42% + ${burst.bX}px)`, top: `calc(50% + ${burst.bY}px)` }}
            className="sandbox-bolt sandbox-bolt-b pointer-events-none absolute text-[0.52rem] text-[#fff2a8] opacity-0"
          >
            ⚡︎
          </span>
          <span
            style={{ right: `calc(4% + ${burst.cX}px)`, top: `calc(50% + ${burst.cY}px)` }}
            className="sandbox-bolt sandbox-bolt-c pointer-events-none absolute text-[0.82rem] text-[#ffd447] opacity-0"
          >
            ⚡︎
          </span>
          <span
            style={{ left: `calc(66% + ${burst.dX}px)`, top: `calc(50% + ${burst.dY}px)` }}
            className="sandbox-bolt sandbox-bolt-d pointer-events-none absolute text-[0.4rem] text-[#fff7cf] opacity-0"
          >
            ⚡︎
          </span>
          <span
            style={{ left: `calc(22% + ${burst.eX}px)`, top: `calc(50% + ${burst.eY}px)` }}
            className="sandbox-bolt sandbox-bolt-e pointer-events-none absolute text-[0.58rem] text-[#ffc83d] opacity-0"
          >
            ⚡︎
          </span>
        </span>
      ))}
    </a>
  );
}

export const Nav = () => {
  const { session, signOut } = useAuth();
  return (
  <header className="relative z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
    <nav className="container relative flex h-16 items-center justify-between" aria-label="Primary">
      <div className="z-10 flex items-center gap-4">
        <a href="/" className="group flex items-center gap-2 mono text-sm tracking-wider">
          <img src={soundemoteLogo.url} alt="Soundemote logo" className="h-5 w-5" />
          <span className="display text-warm-white">soundemote</span>
        </a>
      </div>
      <div className="z-10 flex items-center gap-4">
        {/* Site-wide search. Also opens on Cmd/Ctrl-K or "/" from anywhere. */}
        <SiteSearch />

        <a
          href="https://github.com/soundemote"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:opacity-80"
          aria-label="GitHub"
        >
          <img
            src="/social/github.svg"
            alt="GitHub"
            className="h-4 w-4"
          />
        </a>
        <a
          href="https://www.youtube.com/@soundemote0"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:opacity-80"
          aria-label="YouTube"
        >
          <img
            src="/social/youtube.svg"
            alt="YouTube"
            className="h-4 w-4"
          />
        </a>
        <a
          href="https://bsky.app/profile/soundemote.bsky.social"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:opacity-80"
          aria-label="Bluesky"
        >
          <img
            src="/social/bluesky.svg"
            alt="Bluesky"
            className="h-4 w-4"
          />
        </a>
        <a
          href="https://discord.gg/hjpBC8kZ3s"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:opacity-80"
          aria-label="Discord"
        >
          <img
            src="/social/discord.svg"
            alt="Discord"
            className="h-4 w-4"
          />
        </a>
        <ShareProjectDialog />
        {session ? (
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="mono text-[0.7rem] text-muted-foreground/60 hover:text-muted-foreground"
            aria-label="Sign out"
            title="Sign out"
          >
            sign out
          </button>
        ) : (
          <a
            href="/auth"
            className="mono text-[0.7rem] text-muted-foreground/60 hover:text-muted-foreground"
            aria-label="Sign in"
            title="Sign in"
          >
            ·
          </a>
        )}
      </div>
    </nav>
  </header>
  );
};

export default Nav;
