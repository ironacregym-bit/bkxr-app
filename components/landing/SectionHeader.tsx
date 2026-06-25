// components/iron-acre/SectionHeader.tsx
import styles from "../../styles/IronAcreLanding.module.css";
export default function SectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className={styles.sectionHeader}>
      <div className="ia-kicker">
        <i className={`fas fa-circle-notch ${styles.kickerDot}`} />
        {kicker}
      </div>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {subtitle ? <p className={styles.sectionSubtitle}>{subtitle}</p> : null}
    </div>
  );
}
