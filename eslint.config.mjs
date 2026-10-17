import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default tseslint.config({ignores:['dist/**','node_modules/**','artifacts/**','test-results/**']},js.configs.recommended,...tseslint.configs.recommended,{files:['src/**/*.{ts,tsx}'],languageOptions:{globals:{window:'readonly',document:'readonly',navigator:'readonly',localStorage:'readonly',fetch:'readonly',setTimeout:'readonly',clearTimeout:'readonly',URL:'readonly',Blob:'readonly',KeyboardEvent:'readonly',HTMLElement:'readonly',HTMLDialogElement:'readonly'}},plugins:{'react-hooks':hooks},rules:{'react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'error'}},{files:['scripts/*.mjs'],languageOptions:{globals:{process:'readonly',console:'readonly'}}});
