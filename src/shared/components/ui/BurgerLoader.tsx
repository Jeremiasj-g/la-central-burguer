import styles from './BurgerLoader.module.css';

interface BurgerLoaderProps {
  size?: number;
  className?: string;
}

export function BurgerLoader({ size = 156, className }: BurgerLoaderProps) {
  return (
    <div
      className={className ? `${styles.wrap} ${className}` : styles.wrap}
      role="status"
      aria-label="Cargando"
      style={{ width: size, height: size }}
    >
      <svg
        className={styles.loader}
        style={{ width: size, height: size }}
        viewBox="0 0 180 180"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g className={styles.impact}>
          <g className={`${styles.layer} ${styles.topBun}`}>
            <path d="M40 72C42 43 61 27 90 27C119 27 138 43 140 72H40Z" fill="#E9A23B" />
            <path
              d="M46 65C51 45 67 34 90 34C113 34 129 45 134 65"
              fill="none"
              stroke="#F7C96D"
              strokeWidth="4"
              strokeLinecap="round"
              opacity=".7"
            />
            <g fill="#F8E0A5" opacity=".9">
              <ellipse cx="69" cy="45" rx="3.2" ry="1.6" transform="rotate(-26 69 45)" />
              <ellipse cx="91" cy="40" rx="3.2" ry="1.6" transform="rotate(8 91 40)" />
              <ellipse cx="112" cy="48" rx="3.2" ry="1.6" transform="rotate(28 112 48)" />
            </g>
          </g>

          <g className={`${styles.layer} ${styles.lettuce}`}>
            <path
              d="M39 76C48 69 56 82 66 75C76 68 84 81 94 75C104 69 113 81 123 75C130 71 136 73 141 77L137 85H43L39 76Z"
              fill="#79A943"
            />
          </g>

          <g className={`${styles.layer} ${styles.cheese}`}>
            <path d="M48 85H132L124 99L112 94L101 103L90 95L79 102L68 94L56 99L48 85Z" fill="#EFAE2E" />
          </g>

          <g className={`${styles.layer} ${styles.tomato}`}>
            <rect x="48" y="101" width="84" height="10" rx="5" fill="#CE5248" />
            <path d="M60 105H120" stroke="#EF8177" strokeWidth="2.5" strokeLinecap="round" opacity=".55" />
          </g>

          <g className={`${styles.layer} ${styles.patty}`}>
            <rect x="43" y="114" width="94" height="20" rx="10" fill="#512A18" />
            <path d="M56 121H124M61 128H119" stroke="#71402A" strokeWidth="2.4" strokeLinecap="round" opacity=".7" />
          </g>

          <g className={`${styles.layer} ${styles.bottomBun}`}>
            <path d="M43 137H137V141C137 151 129 157 119 157H61C51 157 43 151 43 141V137Z" fill="#DB8B27" />
            <path
              d="M52 145C65 151 115 151 128 145"
              fill="none"
              stroke="#F0B654"
              strokeWidth="3"
              strokeLinecap="round"
              opacity=".55"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
