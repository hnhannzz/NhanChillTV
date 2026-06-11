import { useRef, useEffect } from 'react';

export function useDraggableScroll() {
  const ref = useRef(null);

  useEffect(() => {
    const ele = ref.current;
    if (!ele) return;

    let isDown = false;
    let startX;
    let scrollLeft;
    let isDragging = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchScrollLeft = 0;
    let touchDirection = null;
    let dragResetTimer = null;

    const onMouseDown = (e) => {
      isDown = true;
      isDragging = false;
      ele.classList.add('cursor-grabbing');
      ele.style.scrollSnapType = 'none'; // Disable snapping while dragging
      startX = e.pageX - ele.offsetLeft;
      scrollLeft = ele.scrollLeft;
    };

    const onMouseLeave = () => {
      isDown = false;
      ele.classList.remove('cursor-grabbing');
      ele.style.scrollSnapType = '';
    };

    const onMouseUp = () => {
      isDown = false;
      ele.classList.remove('cursor-grabbing');
      ele.style.scrollSnapType = '';
    };

    const onMouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - ele.offsetLeft;
      const walk = (x - startX) * 2; // Scroll-fast multiplier
      if (Math.abs(walk) > 5) {
        isDragging = true;
      }
      ele.scrollLeft = scrollLeft - walk;
    };

    const onClick = (e) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onTouchStart = (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchScrollLeft = ele.scrollLeft;
      touchDirection = null;
      isDragging = false;
    };

    const onTouchMove = (e) => {
      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (!touchDirection) {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 7) return;
        touchDirection = Math.abs(deltaX) > Math.abs(deltaY) * 1.15 ? 'horizontal' : 'vertical';
        if (touchDirection === 'horizontal') ele.style.scrollSnapType = 'none';
      }

      // Vertical gestures remain native so the page keeps scrolling on iOS.
      if (touchDirection !== 'horizontal') return;

      e.preventDefault();
      isDragging = Math.abs(deltaX) > 8;
      ele.scrollLeft = touchScrollLeft - deltaX;
    };

    const onTouchEnd = () => {
      ele.style.scrollSnapType = '';
      touchDirection = null;
      if (dragResetTimer) clearTimeout(dragResetTimer);
      dragResetTimer = setTimeout(() => { isDragging = false; }, 120);
    };

    ele.addEventListener('mousedown', onMouseDown);
    ele.addEventListener('mouseleave', onMouseLeave);
    ele.addEventListener('mouseup', onMouseUp);
    ele.addEventListener('mousemove', onMouseMove);
    ele.addEventListener('click', onClick, true);
    ele.addEventListener('touchstart', onTouchStart, { passive: true });
    ele.addEventListener('touchmove', onTouchMove, { passive: false });
    ele.addEventListener('touchend', onTouchEnd, { passive: true });
    ele.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      if (dragResetTimer) clearTimeout(dragResetTimer);
      ele.removeEventListener('mousedown', onMouseDown);
      ele.removeEventListener('mouseleave', onMouseLeave);
      ele.removeEventListener('mouseup', onMouseUp);
      ele.removeEventListener('mousemove', onMouseMove);
      ele.removeEventListener('click', onClick, true);
      ele.removeEventListener('touchstart', onTouchStart);
      ele.removeEventListener('touchmove', onTouchMove);
      ele.removeEventListener('touchend', onTouchEnd);
      ele.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  return ref;
}
