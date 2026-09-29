import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PlayerRole } from '../types';

interface MascotSlot3DProps {
  role: PlayerRole;
  title: string;
  badge: string;
  zoneDesc?: string;
  colorBg: string;
  icon: React.ReactNode;
  isSelected: boolean;
  disabled?: boolean;
  isEjected?: boolean;
  onSelect: (role: PlayerRole) => void;
  onStartDrag?: (role: PlayerRole, clientX: number, clientY: number, pointerId: number) => void;
}

export const MascotSlot3D: React.FC<MascotSlot3DProps> = ({
  role,
  title,
  badge,
  zoneDesc,
  colorBg,
  icon,
  isSelected,
  disabled = false,
  isEjected = false,
  onSelect,
  onStartDrag,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isHoveredRef = useRef(false);
  const [isHovered, setIsHovered] = useState(false);

  // Setup 3D miniature mascot on circular pedestal
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = 80;
    const height = 82;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 1.6, 4.4);
    camera.lookAt(0, 0.9, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Studio lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(-2, 2, -2);
    scene.add(rimLight);

    // Mascot Master Group
    const mascotGroup = new THREE.Group();
    scene.add(mascotGroup);

    // Palette per role
    let jerseyHex = 0xd63031; // Striker crimson
    let shortsHex = 0x2d3436;
    let rimHex = 0xff4757;
    let numberChar = '9';

    if (role === 'midfielder') {
      jerseyHex = 0x0984e3; // Azure Blue
      shortsHex = 0xf1f2f6;
      rimHex = 0x00d2ff;
      numberChar = '10';
    } else if (role === 'defender') {
      jerseyHex = 0x00b894; // Emerald Green
      shortsHex = 0x2f3542;
      rimHex = 0x2ed573;
      numberChar = '4';
    } else if (role === 'cannon') {
      jerseyHex = 0xf39c12; // Gold Amber
      shortsHex = 0x1e272e;
      rimHex = 0xffa502;
      numberChar = '★';
    }

    const jerseyMat = new THREE.MeshStandardMaterial({
      color: jerseyHex,
      roughness: 0.5,
      metalness: 0.15,
    });
    const shortsMat = new THREE.MeshStandardMaterial({
      color: shortsHex,
      roughness: 0.6,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xdca07e,
      roughness: 0.5,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x1f1917,
      roughness: 0.8,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.3,
    });

    // 1. Circular Pedestal Base
    const pedestalGroup = new THREE.Group();
    mascotGroup.add(pedestalGroup);

    // Dark pedestal disc
    const pedestalGeo = new THREE.CylinderGeometry(0.95, 1.05, 0.22, 24);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.2,
    });
    const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestalMesh.position.y = 0.11;
    pedestalGroup.add(pedestalMesh);

    // Luminous glowing rim ring
    const rimGeo = new THREE.TorusGeometry(1.0, 0.04, 12, 32);
    const rimMat = new THREE.MeshBasicMaterial({ color: rimHex });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.22;
    pedestalGroup.add(rimMesh);

    // 2. 3D Mascot Character
    const charGroup = new THREE.Group();
    charGroup.position.y = 0.24; // Stands firmly on top of pedestal
    mascotGroup.add(charGroup);

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.72, 0.32);
    const torso = new THREE.Mesh(torsoGeo, jerseyMat);
    torso.position.y = 1.15;
    charGroup.add(torso);

    // Number patch on chest
    const numCanvas = document.createElement('canvas');
    numCanvas.width = 64;
    numCanvas.height = 64;
    const nCtx = numCanvas.getContext('2d')!;
    nCtx.fillStyle = '#ffffff';
    nCtx.font = 'bold 38px sans-serif';
    nCtx.textAlign = 'center';
    nCtx.textBaseline = 'middle';
    nCtx.fillText(numberChar, 32, 32);
    const numTex = new THREE.CanvasTexture(numCanvas);
    const numBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.24),
      new THREE.MeshBasicMaterial({ map: numTex, transparent: true })
    );
    numBadge.position.set(0, 1.25, 0.17);
    charGroup.add(numBadge);

    // Pelvis / Shorts
    const pelvisGeo = new THREE.BoxGeometry(0.52, 0.32, 0.3);
    const pelvis = new THREE.Mesh(pelvisGeo, shortsMat);
    pelvis.position.y = 0.76;
    charGroup.add(pelvis);

    // Head
    const headGeo = new THREE.BoxGeometry(0.36, 0.36, 0.35);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.72;
    charGroup.add(head);

    // Hair
    const hairGeo = new THREE.BoxGeometry(0.38, 0.14, 0.38);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.91;
    charGroup.add(hair);

    // Arms in athletic ready pose
    const armGeo = new THREE.BoxGeometry(0.15, 0.55, 0.15);
    const armLeft = new THREE.Mesh(armGeo, jerseyMat);
    armLeft.position.set(-0.35, 1.12, 0);
    armLeft.rotation.z = 0.18;
    charGroup.add(armLeft);

    const armRight = new THREE.Mesh(armGeo, jerseyMat);
    armRight.position.set(0.35, 1.12, 0);
    armRight.rotation.z = -0.18;
    charGroup.add(armRight);

    // Left leg
    const legGeo = new THREE.BoxGeometry(0.18, 0.42, 0.18);
    const legLeft = new THREE.Mesh(legGeo, skinMat);
    legLeft.position.set(-0.16, 0.44, -0.02);
    charGroup.add(legLeft);

    const bootGeo = new THREE.BoxGeometry(0.2, 0.16, 0.3);
    const bootLeft = new THREE.Mesh(bootGeo, bootMat);
    bootLeft.position.set(-0.16, 0.15, 0.04);
    charGroup.add(bootLeft);

    // Right leg poised forward
    const legRight = new THREE.Mesh(legGeo, skinMat);
    legRight.position.set(0.16, 0.44, 0.08);
    legRight.rotation.x = -0.25;
    charGroup.add(legRight);

    const bootRight = new THREE.Mesh(bootGeo, bootMat);
    bootRight.position.set(0.16, 0.16, 0.18);
    charGroup.add(bootRight);

    // Turntable rotation animation
    let animationId: number;
    let clock = new THREE.Clock();

    const renderLoop = () => {
      animationId = requestAnimationFrame(renderLoop);
      const elapsed = clock.getElapsedTime();

      torso.scale.set(1 + Math.sin(elapsed * 2.5) * 0.02, 1, 1 + Math.sin(elapsed * 2.5) * 0.02);
      charGroup.position.y = 0.24 + Math.sin(elapsed * 2.0) * 0.02;

      const rotSpeed = isHoveredRef.current ? 1.4 : 0.6;
      mascotGroup.rotation.y += rotSpeed * 0.015;

      renderer.render(scene, camera);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationId);
      renderer.dispose();
      scene.clear();
    };
  }, [role]);

  // Pointer drag handling: directly grab the 3D mascot onto field
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    if (onStartDrag) {
      onStartDrag(role, e.clientX, e.clientY, e.pointerId);
    }
  };

  const handleClick = () => {
    if (disabled || isEjected) return;
    onSelect(role);
  };

  return (
    <div
      id={`mascot-slot-${role}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onMouseEnter={() => {
        isHoveredRef.current = true;
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        setIsHovered(false);
      }}
      className={`group relative w-[72px] sm:w-[78px] md:w-[84px] border-[2px] rounded-2xl p-1.5 flex flex-col items-center justify-between text-center select-none touch-manipulation transition-all duration-200 ${
        isEjected
          ? 'bg-red-950/90 border-red-600 opacity-60 grayscale cursor-not-allowed shadow-none'
          : disabled
          ? 'bg-slate-900/95 opacity-40 grayscale cursor-not-allowed border-neutral-700 shadow-none'
          : isSelected
          ? 'ring-2 ring-amber-400 -translate-y-1 shadow-[0_4px_0_#000] bg-slate-800 border-black cursor-grab active:cursor-grabbing'
          : 'bg-slate-900/95 border-black shadow-[0_3px_0_#000] hover:translate-y-[-2px] hover:shadow-[0_5px_0_#000] active:translate-y-0 active:shadow-[0_1px_0_#000] cursor-grab active:cursor-grabbing'
      }`}
      title={
        isEjected
          ? `RED CARD EJECTED: ${title} took too many power hits and left the pitch. Team is playing with -1 player.`
          : disabled
          ? 'Squad full (max 3 players)'
          : `Grab ${title} onto pitch or tap to place`
      }
    >
      {/* 1. Header: Minimal Tag & Role Indicator */}
      <div className="w-full flex items-center justify-between px-0.5">
        {isEjected ? (
          <span className="text-[8px] font-black px-1.5 py-0.5 bg-red-600 text-white rounded-md tracking-wider">
            -1
          </span>
        ) : (
          <span className="text-[9px] font-black px-1.5 py-0.5 bg-black text-white rounded-md tracking-wider">
            {badge}
          </span>
        )}
        <div
          className={`w-3.5 h-3.5 rounded-full ${
            isEjected ? 'bg-red-600' : colorBg
          } border border-black flex items-center justify-center shrink-0 shadow-xs`}
        >
          {isEjected ? (
            <span className="w-1.5 h-2 bg-red-200 rounded-2xs inline-block" />
          ) : (
            icon
          )}
        </div>
      </div>

      {/* 2. Interactive 3D Mascot Pedestal Viewport */}
      <div className="relative w-[68px] h-[72px] sm:w-[74px] sm:h-[78px] flex items-center justify-center my-0.5">
        <canvas
          ref={canvasRef}
          className="w-full h-full block pointer-events-none drop-shadow-md"
        />

        {/* Ejected badge overlay */}
        {isEjected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[8px] font-black uppercase tracking-wider bg-red-600 text-white px-1.5 py-0.5 rounded-md border border-black shadow-xs">
              RED CARD
            </span>
          </div>
        )}

        {/* Minimal grab indicator on hover */}
        {!disabled && !isEjected && (
          <div
            className={`absolute inset-0 flex items-end justify-center pb-0.5 pointer-events-none transition-opacity duration-200 ${
              isHovered || isSelected ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span className="text-[7.5px] font-black uppercase tracking-wider bg-amber-400 text-black px-1.5 py-0.5 rounded-full border border-black shadow-xs">
              GRAB
            </span>
          </div>
        )}
      </div>

      {/* 3. Minimal Title & Zone */}
      <span
        className={`text-[9px] sm:text-[10px] font-black tracking-wider uppercase leading-tight ${
          isEjected ? 'text-red-400 line-through' : 'text-white'
        }`}
      >
        {title}
      </span>
      {zoneDesc && (
        <span
          className={`text-[7.5px] font-bold uppercase tracking-tight mt-0.5 ${
            isEjected ? 'text-red-500 font-black' : 'text-neutral-400'
          }`}
        >
          {isEjected ? 'EJECTED' : zoneDesc}
        </span>
      )}
    </div>
  );
};
