export default {
  // Workers share the host runtime; isolated process launches are unreliable in
  // the Windows sandbox. Test definitions and assertions remain unchanged.
  test: { pool: 'threads' },
};
