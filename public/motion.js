// Visual-only motion. Respects reduced-motion preferences.
(()=>{const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduce)return;const progress=document.getElementById('pageProgress');let ticking=false;
 function measure(){const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);if(progress)progress.style.width=(Math.min(100,scrollY/max*100))+'%';ticking=false;}
 addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(measure)}},{passive:true});measure();
 const elements=document.querySelectorAll('.section-head,.booking-wrap,.closing,.footer-grid');
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-motion');observer.unobserve(e.target)}})},{threshold:.12});elements.forEach(el=>{el.classList.add('motion-target');observer.observe(el)})}
 const s=document.createElement('style');s.textContent='.motion-target:not(.in-motion){opacity:0;transform:translateY(24px)}.motion-target{transition:opacity .75s ease,transform .75s cubic-bezier(.2,.8,.2,1)}.motion-target.in-motion{opacity:1;transform:translateY(0)}';document.head.append(s);
})();
