import { useNavigate } from 'react-router-dom';
import AntarcticStoryScroller from '../components/cinematic/AntarcticStoryScroller';
import { useLenisScroll } from '../hooks/useLenisScroll';

export default function Landing() {
  const navigate = useNavigate();
  useLenisScroll({ lerp: 0.085 });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FFFFFF] overflow-x-hidden">
      <AntarcticStoryScroller onEnterCommandCenter={() => navigate('/command')} />
    </div>
  );
}
