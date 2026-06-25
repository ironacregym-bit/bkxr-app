// components/landing/PathCardItem.tsx
import Link from "next/link";
import styles from "../../styles/IronAcreLanding.module.css";
import type { PathCard } from "../../lib/landing/ironAcreLandingContent";

type Props = {
  card: PathCard;
};

export default function PathCardItem({ card }: Props) {
  const content = (
    <div className={styles.pathCard}>
      <div className={styles.pathTop}>
        <div className={styles.iconWrap}>
          <i className={`fas ${card.icon}`} />
        </div>
        {card.badge ? <span className={styles.pathBadge}>{card.badge}</span> : null}
      </div>

      <div className={styles.pathTitle}>{card.title}</div>
      <div className={styles.pathBody}>{card.body}</div>

      <div className={styles.pathLink}>
        {card.cta}
        <i className="fas fa-arrow-right" />
      </div>
    </div>
  );

  if (card.href.startsWith("http")) {
    return (
      <a
        href={card.href}
        className="ia-link-no-underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={card.href} className="ia-link-no-underline">
      {content}
    </Link>
  );
}
