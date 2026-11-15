import Link from "next/link";
import styles from "./home.module.css";

const waitlistUrl = "https://www.waitlistr.com/lists/9f7e9a3a/rush-lab";

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}
function FestivalPreview() {
  const booths = [
    { x: 95, y: 180, fill: "#eb945c", name: "TACOS" },
    { x: 220, y: 180, fill: "#e2b754", name: "COFFEE" },
    { x: 95, y: 312, fill: "#d7a9a1", name: "PIZZA" },
    { x: 350, y: 312, fill: "#e2b754", name: "JUICE" },
  ];
  const guests = [
    [174, 237],
    [187, 248],
    [202, 232],
    [212, 264],
    [238, 240],
    [261, 253],
    [275, 231],
    [294, 264],
    [317, 246],
    [339, 235],
    [353, 268],
    [365, 242],
    [182, 290],
    [227, 294],
    [268, 283],
    [306, 295],
    [323, 203],
    [286, 177],
    [300, 153],
    [174, 158],
    [203, 149],
    [270, 342],
    [285, 362],
    [308, 377],
    [335, 351],
    [357, 383],
    [229, 376],
    [180, 370],
  ];
  return (
    <div className={styles.preview}>
      <div className={styles.previewTop}>
        <span>
          <i /> A little planning. A lot of possibility.
        </span>
        <span>01 / OVERVIEW</span>
      </div>
      <svg
        viewBox="0 0 520 455"
        role="img"
        aria-label="Illustration of a festival layout with vendors, a stage, trees and visitors"
      >
        <defs>
          <pattern
            id="venue-grid"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 22 0 L 0 0 0 22"
              fill="none"
              stroke="#ced8c6"
              strokeWidth="0.6"
            />
          </pattern>
          <filter id="tent-shadow">
            <feDropShadow
              dx="0"
              dy="5"
              stdDeviation="3"
              floodColor="#1d4134"
              floodOpacity="0.10"
            />
          </filter>
        </defs>
        <rect x="22" y="20" width="476" height="412" rx="20" fill="#e5ebde" />
        <rect
          x="22"
          y="20"
          width="476"
          height="412"
          rx="20"
          fill="url(#venue-grid)"
        />
        <rect
          x="53"
          y="49"
          width="414"
          height="352"
          rx="19"
          fill="none"
          stroke="#9faf98"
          strokeDasharray="5 5"
        />
        <path
          d="M255 425V258H74M255 258H451M255 258V124"
          stroke="#f9f5e9"
          strokeWidth="33"
          fill="none"
          strokeLinejoin="round"
        />
        <path
          d="M255 421V258H89M255 258H442M255 258V136"
          stroke="#c9cdbb"
          strokeWidth="1"
          strokeDasharray="3 6"
          fill="none"
        />
        <g transform="translate(191 63)">
          <rect
            width="130"
            height="72"
            rx="5"
            fill="#254e3e"
            filter="url(#tent-shadow)"
          />
          <rect x="10" y="9" width="110" height="41" rx="2" fill="#356851" />
          <path
            d="M25 42V20M105 42V20M60 39L79 27"
            stroke="#e8c66c"
            strokeWidth="3"
          />
          <rect x="16" y="56" width="99" height="4" rx="2" fill="#9eb49b" />
          <text
            x="65"
            y="91"
            textAnchor="middle"
            fontSize="9"
            letterSpacing="2"
            fill="#44614c"
          >
            MAIN STAGE
          </text>
        </g>
        {booths.map((booth) => (
          <g
            key={booth.name}
            transform={`translate(${booth.x} ${booth.y})`}
            filter="url(#tent-shadow)"
          >
            <rect x="0" y="0" width="77" height="51" rx="4" fill="#faf5e6" />
            <path d="M-6 8L38-16L83 8Z" fill={booth.fill} />
            <path d="M38-16V8" stroke="#fff7e8" strokeWidth="2" />
            <rect x="6" y="8" width="65" height="11" fill={booth.fill} />
            <path
              d="M16 9V18M31 9V18M46 9V18M61 9V18"
              stroke="#fff7e8"
              strokeWidth="5"
            />
            <text
              x="38"
              y="38"
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              letterSpacing="1"
              fill="#3a5345"
            >
              {booth.name}
            </text>
          </g>
        ))}
        {[
          [73, 85],
          [106, 102],
          [415, 95],
          [441, 130],
          [72, 351],
          [428, 381],
          [385, 168],
        ].map(([x, y], i) => (
          <g key={i}>
            <ellipse
              cx={x + 2}
              cy={y + 8}
              rx="17"
              ry="12"
              fill="#233e2e"
              opacity="0.07"
            />
            <circle cx={x} cy={y} r="17" fill={i % 2 ? "#8ca479" : "#6c8b68"} />
            <circle
              cx={x - 4}
              cy={y - 5}
              r="10"
              fill="#a1b68b"
              opacity="0.65"
            />
          </g>
        ))}
        {guests.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3.3"
            fill={i % 5 === 0 ? "#d98651" : i % 3 === 0 ? "#d1b25d" : "#54776b"}
            stroke="#edf0e4"
            strokeWidth="1"
          />
        ))}
        <g transform="translate(373 52)">
          <circle cx="28" cy="28" r="21" fill="#f8f5eb" />
          <path d="M28 13L33 34L28 29L23 34Z" fill="#355747" />
          <text x="28" y="6" textAnchor="middle" fontSize="7" fill="#355747">
            N
          </text>
        </g>
        <rect x="226" y="412" width="59" height="18" rx="4" fill="#254e3e" />
        <text
          x="255"
          y="424"
          textAnchor="middle"
          fontSize="7"
          letterSpacing="1.4"
          fill="#faf7eb"
        >
          WELCOME
        </text>
      </svg>
      <div className={styles.previewBottom}>
        <span>
          <i /> Your layout, brought to life.
        </span>
        <span>Illustrative venue</span>
      </div>
      <div className={styles.floatingNote}>
        <span className={styles.noteIcon}>↗</span>
        <div>
          <strong>Find a better flow.</strong>
          <span>Test the possibilities before event day.</span>
        </div>
      </div>
    </div>
  );
}
export default function Home() {
  return (
    <main className={styles.home}>
      <a href="#main-intro" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.nav}>
        <Link href="/" className={styles.logo} aria-label="RushLab home">
          <span className={styles.logoMark}>
            r<span>↗</span>
          </span>
          RushLab<span className={styles.logoDot}>.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/login">Sign in</Link>
          <a href="#how-it-works">How it works</a>
          <a href="#possibilities">The possibilities</a>
        </nav>
        <a
          href={waitlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.navCta}
          aria-label="Join the RushLab waitlist (opens in a new tab)"
        >
          Join the waitlist <Arrow diagonal />
        </a>
      </header>
      <section id="main-intro" className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span /> FOR THE PEOPLE BEHIND THE EVENT
          </p>
          <h1>
            Great events
            <br />
            start <em>before</em>
            <br />
            the gates open.
          </h1>
          <p className={styles.intro}>
            Meet RushLab. Your space to design festival layouts, explore guest
            behavior, and see what a better event could look like.
          </p>
          <div className={styles.heroActions}>
            <a
              href={waitlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.cta}
              aria-label="Join the RushLab waitlist (opens in a new tab)"
            >
              Join the waitlist <Arrow diagonal />
            </a>
            <Link href="/workspace" className={styles.textLink}>
              Try the workspace <Arrow />
            </Link>
          </div>
          <p className={styles.smallNote}>
            Made for festival &amp; market organizers. Explore the demo without
            an account.
          </p>
        </div>
        <FestivalPreview />
      </section>
      <div className={styles.ribbon}>
        <span>LESS GUESSWORK.</span>
        <span className={styles.star}>✳</span>
        <span>MORE POSSIBILITY.</span>
        <span className={styles.ribbonEnd}>
          A little foresight goes a long way.
        </span>
      </div>
      <section id="how-it-works" className={styles.process}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>
            FROM FIRST SKETCH TO BETTER DECISIONS
          </p>
          <h2>
            Your event.
            <br />
            <em>Ahead of the crowd.</em>
          </h2>
          <p>
            Where should the coffee stall go? What happens when queues build up?
            Try it here, before you commit out there.
          </p>
        </div>
        <div className={styles.steps}>
          <article>
            <span className={styles.stepNumber}>01 / DESIGN</span>
            <div className={styles.stepSymbol} aria-hidden="true">
              ⌘
            </div>
            <h3>Make room for your ideas.</h3>
            <p>
              Build your venue with vendors, stages, gates and amenities. Move
              things around until the plan feels right.
            </p>
          </article>
          <article>
            <span className={styles.stepNumber}>02 / SIMULATE</span>
            <div className={styles.stepSymbol} aria-hidden="true">
              ↝
            </div>
            <h3>See the day in motion.</h3>
            <p>
              Run a repeatable simulation of up to 300 guests. Watch visits,
              vendor queues and purchases unfold.
            </p>
          </article>
          <article>
            <span className={styles.stepNumber}>03 / COMPARE</span>
            <div className={styles.stepSymbol} aria-hidden="true">
              ↗
            </div>
            <h3>Find your next better move.</h3>
            <p>
              Inspect layout issues and compare modeled purchases, revenue,
              missed-sale opportunities and queue waits.
            </p>
          </article>
        </div>
      </section>
      <section id="possibilities" className={styles.possibilities}>
        <div>
          <p className={styles.eyebrow}>
            A TESTING GROUND FOR YOUR NEXT BIG DAY
          </p>
          <h2>
            Big questions.
            <br />
            <em>Room to explore.</em>
          </h2>
          <Link href="/workspace" className={styles.lightCta}>
            Let’s build your event <Arrow />
          </Link>
        </div>
        <div className={styles.questions}>
          <p>
            <span>01</span> Where are guests spending their time?
          </p>
          <p>
            <span>02</span> Which vendors need more service capacity?
          </p>
          <p>
            <span>03</span> What changes when you try another scenario?
          </p>
          <div className={styles.modelNote}>
            A planning tool, with perspective. Results are modeled estimates,
            not forecasts. Explore assumptions and tradeoffs before making
            real-world decisions.
          </div>
        </div>
      </section>
      <section
        id="waitlist"
        className={styles.waitlist}
        aria-labelledby="waitlist-heading"
      >
        <div>
          <p className={styles.eyebrow}>BE PART OF WHAT’S NEXT</p>
          <h2 id="waitlist-heading">
            Better events.
            <br />
            <em>Let’s build them together.</em>
          </h2>
          <p>
            Planning a festival, market or community gathering? Join the RushLab
            waitlist and stay connected as the product grows.
          </p>
        </div>
        <div className={styles.waitlistAction}>
          <span className={styles.waitlistSymbol} aria-hidden="true">
            ✳
          </span>
          <a
            href={waitlistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cta}
            aria-label="Join the RushLab waitlist (opens in a new tab)"
          >
            Join the waitlist <Arrow diagonal />
          </a>
          <p>
            Signup is hosted on Waitlistr.
            <br />
            Opens in a new tab.
          </p>
          <Link href="/workspace" className={styles.textLink}>
            Want to explore first? Try RushLab <Arrow />
          </Link>
        </div>
      </section>
      <footer className={styles.footer}>
        <Link href="/" className={styles.footerLogo}>
          RushLab.
        </Link>
        <span>A little planning. A better gathering.</span>
        <Link href="/workspace">
          Step into the workspace <Arrow diagonal />
        </Link>
      </footer>
    </main>
  );
}
