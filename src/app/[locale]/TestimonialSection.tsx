import s from "./TestimonialSection.module.css";

export default function TestimonialSection() {
  return (
    <section className={s.wrap} aria-label="Echorank customer testimonial">
      <div className={s.inner}>
        <span className={s.eyebrow}>TESTIMONIAL</span>

        <div className={s.frame}>
          <svg
            className={s.frameSvg}
            viewBox="0 0 1448 1086"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="eg-testi" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#FDE38A" />
                <stop offset="1" stopColor="#F0B90B" />
              </linearGradient>
            </defs>
            <rect
              x="4" y="4" width="1440" height="1078" rx="20"
              fill="none" stroke="url(#eg-testi)" strokeWidth="3"
            />
          </svg>

          <svg className={s.quote} viewBox="0 0 96 72" aria-hidden="true">
            <path
              d="M0 72V40C0 17 14 3 40 0l4 12c-15 4-22 12-23 24h21v36H0Zm54 0V40C54 17 68 3 94 0l2 12c-15 4-22 12-23 24h21v36H54Z"
              fill="#F0B90B"
            />
          </svg>

          <img
            className={s.img}
            src="/testimonials/testimonial-sarah.webp"
            width={1448}
            height={1086}
            loading="lazy"
            decoding="async"
            alt="Echorank customer testimonial — Sarah M., business owner"
          />
        </div>
      </div>
    </section>
  );
}
