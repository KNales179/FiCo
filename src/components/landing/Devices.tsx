/**
 * Fico on a laptop, a tablet and a phone: real screenshots of the demo
 * (public/landing/*.webp) in simple CSS device frames. Each device has a
 * dark and a light shot, and shows the one matching the page's theme.
 */

const Shot = ({ name, alt }: { name: 'laptop' | 'tablet' | 'phone'; alt: string }) => (
  <>
    <img src={`/landing/${name}-dark.webp`} alt={alt} loading="lazy" decoding="async" className="theme-dark-only block h-full w-full object-cover object-top" />
    <img src={`/landing/${name}-light.webp`} alt={alt} loading="lazy" decoding="async" className="theme-light-only block h-full w-full object-cover object-top" />
  </>
)

const Devices = () => (
  <div className="relative mx-auto aspect-[16/15] w-full max-w-6xl sm:aspect-[16/12]" aria-label="Fico on a laptop, a tablet and a phone" role="img">
    {/* Laptop */}
    <div className="absolute left-1/2 top-0 w-[86%] -translate-x-1/2 sm:w-[66%]">
      <div className="device-bezel overflow-hidden rounded-t-[1.1rem] border-[0.6rem] border-b-[0.9rem]">
        <div className="aspect-[16/10] overflow-hidden rounded-[0.25rem]">
          <Shot name="laptop" alt="The Fico dashboard on a laptop" />
        </div>
      </div>
      <div className="device-base mx-auto h-[0.9rem] w-[112%] -translate-x-[5.4%] rounded-b-[1.2rem]">
        <div className="mx-auto h-[0.35rem] w-[16%] rounded-b-md bg-black/20" />
      </div>
    </div>

    {/* Tablet */}
    <div className="device-bezel absolute bottom-0 left-0 w-[44%] overflow-hidden rounded-[1.4rem] border-[0.55rem] shadow-2xl sm:w-[34%]">
      <div className="aspect-[820/1180] overflow-hidden rounded-[0.8rem]">
        <Shot name="tablet" alt="Fico analytics on a tablet" />
      </div>
    </div>

    {/* Phone */}
    <div className="device-bezel absolute bottom-0 right-0 w-[30%] overflow-hidden rounded-[1.6rem] border-[0.45rem] shadow-2xl sm:right-[2%] sm:w-[22%]">
      <div className="relative flex aspect-[600/1360] flex-col overflow-hidden rounded-[1.15rem] bg-panel">
        {/* Status bar, where the camera sits — so it never covers the app. */}
        <div className="relative h-[4.6%] shrink-0" aria-hidden="true">
          <span className="absolute left-1/2 top-1/2 h-[55%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
        </div>
        <div className="min-h-0 flex-1">
          <Shot name="phone" alt="The Fico dashboard on a phone" />
        </div>
      </div>
    </div>
  </div>
)

export default Devices
