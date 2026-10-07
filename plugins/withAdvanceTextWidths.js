/**
 * Keeps Android's text boxes sized the way React Native measures them.
 *
 * From Android 15, an app built for it lays text out by the outline of its letters instead of
 * their widths. React Native still measures by widths, so a Nastaliq word whose strokes reach past
 * its width ("کیش اِن", "کوٹیشنز") was given a box Android then found too narrow, and Android wrapped
 * part of the word onto a second line that is not shown. Turning the new behaviour off for the app's
 * text views makes both sides agree again; the app leaves room for the strokes itself (src/ui/fonts.ts).
 */
const { withAndroidStyles, AndroidConfig } = require('expo/config-plugins');

const STYLE = 'BillKulText';

module.exports = function withAdvanceTextWidths(config) {
  return withAndroidStyles(config, (mod) => {
    const styles = mod.modResults;
    styles.resources.style = styles.resources.style ?? [];
    if (!styles.resources.style.some((style) => style.$.name === STYLE)) {
      styles.resources.style.push({
        $: { name: STYLE, parent: 'android:Widget.Material.TextView' },
        item: [
          { $: { name: 'android:useBoundsForWidth' }, _: 'false' },
          { $: { name: 'android:shiftDrawingOffsetForStartOverhang' }, _: 'false' },
        ],
      });
    }
    mod.modResults = AndroidConfig.Styles.assignStylesValue(styles, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:textViewStyle',
      value: `@style/${STYLE}`,
    });
    return mod;
  });
};
