import { useNavigate } from 'react-router-dom';
import AntarcticStoryScroller from '../components/cinematic/AntarcticStoryScroller';
import AdaptiveHeader from '../components/navigation/AdaptiveHeader';
import { useLenisScroll } from '../hooks/useLenisScroll';

/* Scroll progress windows mirrored from AntarcticStoryScroller */
const SCENE_PROGRESS = [0.0, 0.125, 0.255, 0.465, 0.585, 0.72, 0.83, 0.925];

export default function Landing() {
  const navigate = useNavigate();
  const lenisRef = useLenisScroll({ lerp: 0.085 });

  const scrollToScene = (target: string) => {
    const idx = Number(target.replace('scene-', '')) - 1;
    const progress = SCENE_PROGRESS[idx] ?? 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = Math.max(1, progress * max);
    if (lenisRef.current) {
      lenisRef.current.scrollTo(y, { duration: 2.2 });
    } else {
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="theme-dark min-h-screen bg-polar-deep">
      <AdaptiveHeader mode="mission" onNavigateMission={scrollToScene} />
      <AntarcticStoryScroller onEnterCommandCenter={() => navigate('/command')} />
    </div>
  );
}
