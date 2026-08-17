import Image from 'next/image';
import TopBar from '@/components/TopBar';
import CenterTitle from '@/components/CenterTitle';
import MusicPlayer from '@/components/MusicPlayer';

export default function Home() {
  return (
    <>
      {/* Full-screen background */}
      <div className="background">
        <Image
          src="/background.jpeg"
          alt="Deluxe Mix Background"
          fill
          className="bg-image"
          priority
          unoptimized
        />
        <div className="bg-overlay" />
      </div>

      {/* Top Status Bar */}
      <TopBar />

      {/* Center White Text Overlay */}
      <CenterTitle />

      {/* Music Player */}
      <MusicPlayer />
    </>
  );
}
