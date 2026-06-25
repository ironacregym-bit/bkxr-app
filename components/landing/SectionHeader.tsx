// components/landing/SectionHeader.tsx
import styles from "../../styles/IronAcreLanding.module.css";

type Props = {
  kicker: string;
  title: string;
  subtitle?: string;
};

export default function SectionHeader({ kicker, title, subtitle }: Props) {
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
