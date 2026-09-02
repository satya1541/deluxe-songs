import TopBar from '@/components/TopBar';
import CenterTitle from '@/components/CenterTitle';
import MusicPlayer from '@/components/MusicPlayer';
import DynamicBackground from '@/components/DynamicBackground';

export default function Home() {
  return (
    <>
      {/* Dynamic Multi-Device Background with 4-Hour Rotation */}
      <DynamicBackground />

      {/* Top Status Bar */}
      <TopBar />

      {/* Center White Text Overlay */}
      <CenterTitle />

      {/* Music Player */}
      <MusicPlayer />
    </>
  );
}
