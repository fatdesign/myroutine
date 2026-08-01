fetch('https://loadmuscle.com/free-workout-planner/mkVWdlNeTOad')
  .then(r => r.text())
  .then(html => {
    const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']+)["']/g)];
    const fallback = [...html.matchAll(/<img[^>]*alt=["']([^"']+)["'][^>]+src=["']([^"']+)["']/g)];
    
    matches.forEach(m => console.log(m[2] + ': ' + m[1]));
    fallback.forEach(m => console.log(m[1] + ': ' + m[2]));
  });
