'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';

const DESKTOP_BACKGROUNDS = [
  '/backgrounds/desktop/desktop-1.jpeg',
  '/backgrounds/desktop/desktop-2.jpeg',
  '/backgrounds/desktop/desktop-3.jpeg',
  '/backgrounds/desktop/desktop-4.jpeg',
];

const TABLET_BACKGROUNDS = [
  '/backgrounds/tablet/tablet-1.jpeg',
  '/backgrounds/tablet/tablet-2.jpeg',
  '/backgrounds/tablet/tablet-3.jpeg',
  '/backgrounds/tablet/tablet-4.jpeg',
];

const MOBILE_BACKGROUNDS = [
  '/backgrounds/mobile/mobile-1.jpeg',
  '/backgrounds/mobile/mobile-2.jpeg',
  '/backgrounds/mobile/mobile-3.jpeg',
  '/backgrounds/mobile/mobile-4.jpeg',
];

type DeviceType = 'mobile' | 'tablet' | 'desktop';

function get4HourSlotIndex(): number {
  const hours = new Date().getHours();
  // Cycles every 4 hours: [0-3 -> 0], [4-7 -> 1], [8-11 -> 2], [12-15 -> 3], [16-19 -> 0], [20-23 -> 1]
  return Math.floor(hours / 4) % 4;
}

function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width <= 640) return 'mobile';
  if (width <= 1024) return 'tablet';
  return 'desktop';
}

export default function DynamicBackground() {
  const [slotIndex, setSlotIndex] = useState<number>(get4HourSlotIndex);
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [currentImage, setCurrentImage] = useState<string>('/backgrounds/desktop/desktop-1.jpeg');
  const [previousImage, setPreviousImage] = useState<string | null>(null);
  const [isCrossFading, setIsCrossFading] = useState<boolean>(false);

  // Compute active target image path based on device & 4-hour slot
  const targetImage = useMemo(() => {
    let list = DESKTOP_BACKGROUNDS;
    if (deviceType === 'mobile') list = MOBILE_BACKGROUNDS;
    else if (deviceType === 'tablet') list = TABLET_BACKGROUNDS;
    return list[slotIndex % list.length] || list[0];
  }, [deviceType, slotIndex]);

  // Handle device resize and initial device detection
  useEffect(() => {
    const handleResize = () => {
      const detected = getDeviceType();
      setDeviceType(detected);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update 4-hour clock slot on interval
  useEffect(() => {
    const checkSlot = () => {
      const current = get4HourSlotIndex();
      setSlotIndex(current);
    };

    checkSlot();
    // Check every 60 seconds to detect 4-hour boundaries accurately
    const interval = setInterval(checkSlot, 60000);
    return () => clearInterval(interval);
  }, []);

  // Smooth cross-fade transition when target image changes
  useEffect(() => {
    if (targetImage === currentImage) return;

    setPreviousImage(currentImage);
    setCurrentImage(targetImage);
    setIsCrossFading(true);

    const timer = setTimeout(() => {
      setPreviousImage(null);
      setIsCrossFading(false);
    }, 1600);

    return () => clearTimeout(timer);
  }, [targetImage, currentImage]);

  return (
    <div className="background" aria-hidden="true">
      {/* Previous fading-out image during cross-fade */}
      {previousImage && (
        <div className={`bg-image-layer bg-fade-out ${isCrossFading ? 'active-fade-out' : ''}`}>
          <Image
            src={previousImage}
            alt="Previous Background"
            fill
            className="bg-image"
            priority
            unoptimized
          />
        </div>
      )}

      {/* Active current image */}
      <div className={`bg-image-layer ${isCrossFading ? 'bg-fade-in' : ''}`}>
        <Image
          src={currentImage}
          alt="Atmospheric Background"
          fill
          className="bg-image"
          priority
          unoptimized
        />
      </div>

      {/* Atmospheric Contrast Overlay */}
      <div className="bg-overlay" />
    </div>
  );
}
