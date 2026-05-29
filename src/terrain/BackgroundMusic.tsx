import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

export const BackgroundMusic = ({ volume, isStarted, isMuted }: { volume: number, isStarted: boolean, isMuted: boolean }) => {
  const instruments = useRef<any>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const sequenceRef = useRef<any>(null);

  useEffect(() => {
    if (!isStarted) return;
    
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 2, decay: 1, sustain: 0.5, release: 4 }
    });
    const reverb = new Tone.Reverb({ decay: 8, wet: 0.7 });
    const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: 0.3 });
    
    synth.chain(delay, reverb, Tone.Destination);
    instruments.current = { synth, reverb, delay };

    const startAudio = async () => {
      await Tone.start();
      setIsAudioReady(true);
    };
    
    startAudio();

    return () => {
      if (sequenceRef.current) {
        sequenceRef.current.stop();
        sequenceRef.current.dispose();
      }
      synth.dispose();
      reverb.dispose();
      delay.dispose();
    };
  }, [isStarted]);

  useEffect(() => {
    if (!instruments.current || !isAudioReady) return;
    
    try {
      Tone.Destination.mute = isMuted;
      Tone.Destination.volume.value = volume;
    } catch (error) {
      console.log('Volume update error:', error);
    }
  }, [volume, isAudioReady, isMuted]);

  useEffect(() => {
    if (!instruments.current || !isAudioReady) return;

    const pattern = [
      { time: 0, notes: ['C3', 'E3', 'G3'] },
      { time: '4n', notes: ['D3', 'G3', 'A3'] },
      { time: '2n', notes: ['E3', 'A3', 'C4'] },
      { time: '2n + 4n', notes: ['G3', 'C4', 'D4'] },
    ];

    let index = 0;
    sequenceRef.current = new Tone.Sequence(
      (time) => {
        const { notes } = pattern[index % pattern.length];
        instruments.current.synth.triggerAttackRelease(notes, '2n', time);
        index++;
      },
      [0, 1, 2, 3],
      '1m'
    );

    Tone.Transport.bpm.value = 40;
    sequenceRef.current.start(0);
    Tone.Transport.start();

    return () => {
      if (sequenceRef.current) {
        sequenceRef.current.stop();
        Tone.Transport.stop();
      }
    };
  }, [isAudioReady]);

  return null;
};
