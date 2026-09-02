import { useNavigate } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import AntarcticStoryScroller from '../components/cinematic/AntarcticStoryScroller';
import { CatPawClickEffect } from '../components/cinematic/CatPawClickEffect';
import { useLenisScroll } from '../hooks/useLenisScroll';

export default function Landing() {
  const navigate = useNavigate();
  useLenisScroll({ lerp: 0.085 });

  const handleEnterCommandCenter = () => {
    ScrollTrigger.getAll().forEach((t) => t.kill());
    document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    navigate('/command');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FFFFFF] overflow-x-hidden">
      <CatPawClickEffect />
      <AntarcticStoryScroller onEnterCommandCenter={handleEnterCommandCenter} />
    </div>
  );
}
