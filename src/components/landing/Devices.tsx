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
  <div className="relative mx-auto aspect-[16/11] w-full max-w-5xl" aria-label="Fico on a laptop, a tablet and a phone" role="img">
    {/* Laptop */}
    <div className="absolute left-1/2 top-0 w-[74%] -translate-x-1/2">
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
    <div className="device-bezel absolute bottom-0 left-[1%] w-[25%] overflow-hidden rounded-[1.4rem] border-[0.55rem] shadow-2xl">
      <div className="aspect-[820/1180] overflow-hidden rounded-[0.8rem]">
        <Shot name="tablet" alt="Fico analytics on a tablet" />
      </div>
    </div>

    {/* Phone */}
    <div className="device-bezel absolute bottom-0 right-[3%] w-[15.5%] overflow-hidden rounded-[1.6rem] border-[0.45rem] shadow-2xl">
      <div className="relative aspect-[600/1298] overflow-hidden rounded-[1.15rem]">
        <span className="absolute left-1/2 top-[1.2%] z-10 h-[2.2%] w-[30%] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
        <Shot name="phone" alt="The Fico dashboard on a phone" />
      </div>
    </div>
  </div>
)

export default Devices
