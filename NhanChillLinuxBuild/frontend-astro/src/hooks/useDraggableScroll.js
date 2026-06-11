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

    ele.addEventListener('mousedown', onMouseDown);
    ele.addEventListener('mouseleave', onMouseLeave);
    ele.addEventListener('mouseup', onMouseUp);
    ele.addEventListener('mousemove', onMouseMove);
    ele.addEventListener('click', onClick, true);

    return () => {
      ele.removeEventListener('mousedown', onMouseDown);
      ele.removeEventListener('mouseleave', onMouseLeave);
      ele.removeEventListener('mouseup', onMouseUp);
      ele.removeEventListener('mousemove', onMouseMove);
      ele.removeEventListener('click', onClick, true);
    };
  }, []);

  return ref;
}
