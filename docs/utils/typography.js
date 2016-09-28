import Typography from 'typography'
import CodePlugin from 'typography-plugin-code'

const options = {
  baseFontSize: '16px',
  baseLineHeight: 1.5,
  bodyFontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Oxygen',
    'Ubuntu',
    'Cantarell',
    'Fira Sans',
    'Droid Sans',
    'Helvetica Neue',
    'sans-serif',
  ],
  bodyWeight: 400,
  headerWeight: 700,
  boldWeight: 700,
  scale: 1.618,
  plugins: [
    new CodePlugin(),
  ],
}

const typography = new Typography(options)

// Hot reload typography in development.
if (process.env.NODE_ENV !== 'production') {
  typography.injectStyles()
}

export default typography
