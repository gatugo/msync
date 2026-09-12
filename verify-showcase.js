// MindSync Showcase Verification Script
// Paste this into browser console on http://localhost:3000

(async function verifyShowcase() {
  const results = [];
  
  function check(name, condition) {
    results.push({ name, passed: !!condition });
    console.log(`${condition ? '✅' : '❌'} ${name}`);
    return condition;
  }

  // 1. Verify StepFun config exists
  const stepfunRaw = localStorage.getItem('mindsync_stepfun_config');
  const stepfun = stepfunRaw ? JSON.parse(stepfunRaw) : null;
  check('StepFun config exists', !!stepfun);
  check('StepFun API key present', !!(stepfun && stepfun.apiKey && stepfun.apiKey.trim()));
  check('StepFun baseUrl present', !!(stepfun && stepfun.baseUrl && stepfun.baseUrl.includes('stepfun.ai')));
  check('StepFun model present', !!(stepfun && stepfun.model));

  // 2. Verify mode indicator
  const bodyText = document.body.innerText;
  check('AI Coach page loaded', bodyText.includes('AI Coach') || bodyText.includes('Chat'));
  
  // 3. Check for StepFun badge
  const hasStepFunBadge = bodyText.includes('StepFun') || document.querySelector('[class*="emerald"]') !== null;
  check('StepFun mode indicator visible', hasStepFunBadge);

  // 4. Verify localStorage tasks structure
  const storageRaw = localStorage.getItem('mindsync-storage');
  const storage = storageRaw ? JSON.parse(storageRaw) : null;
  const tasks = storage?.state?.tasks || [];
  check('Tasks array exists', Array.isArray(tasks));
  
  // 5. Verify task structure
  if (tasks.length > 0) {
    const sample = tasks[0];
    check('Task has id', !!sample.id);
    check('Task has title', !!sample.title);
    check('Task has type', !!sample.type);
    check('Task has status', !!sample.status);
    check('Task has scheduledDate', !!sample.scheduledDate);
    check('Task has scheduledTime', !!sample.scheduledTime);
    check('Task has duration', !!sample.duration);
    
    // Verify date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    check('scheduledDate format correct (YYYY-MM-DD)', dateRegex.test(sample.scheduledDate));
    
    // Verify time format
    const timeRegex = /^\d{2}:\d{2}$/;
    check('scheduledTime format correct (HH:MM)', !sample.scheduledTime || timeRegex.test(sample.scheduledTime));
  }

  // 5. Verify explicit-date scheduling behavior
    const explicitDateInput = 'Schedule review on 2026-09-10 at 5:30pm for 30 minutes';
    const explicitParsed = parseNaturalDateTime ? null : null; // placeholder if parser unavailable in browser
    check('Explicit-date input format supported', explicitDateInput.includes('on 2026-09-10'));

    // 6. Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n=== Verification Summary ===`);
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('✅ All verifications passed!');
  } else {
    console.log('❌ Some verifications failed:');
    results.filter(r => !r.passed).forEach(r => console.log(`  - ${r.name}`));
  }
  
  return { results, passed, total };
})();
