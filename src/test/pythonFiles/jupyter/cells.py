#%%
%matplotlib inline
import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np

x = np.linspace(0, 20, 100)
plt.plot(x, np.sin(x))
plt.show()

# In[]
import sys
print(sys.version)
print(sys.executable)
print(2)
import time
for x in range(0, 3):
    print "We're on time %d" % (x)
    print(x)
print('1')

# In[]
print('start')
for x in range(0, 3):
    print(x)
print('end')

#%%
plt.plot([1, 2, 3, 2, 3, 2, 2, 1])
plt.show()

#%%
import matplotlib.pyplot as plt
import numpy as np
import mpld3

mpld3.enable_notebook()

fig, ax = plt.subplots(subplot_kw=dict(axisbg='#EEEEEE'))
ax.grid(color='white', linestyle='solid')

N = 50
scatter = ax.scatter(np.random.normal(size=N),
                     np.random.normal(size=N),
                     c=np.random.random(size=N),
                     s=1000 * np.random.random(size=N),
                     alpha=0.3,
                     cmap=plt.cm.jet)

ax.set_title("D3 Scatter Plot", size=18)

#%%
from IPython.core.display import HTML
HTML("<iframe src='http://www.ncdc.noaa.gov/oa/satellite/satelliteseye/cyclones/pfctstorm91/pfctstorm.html' width='750' height='600'></iframe>")

#%%
%matplotlib inline
from bokeh.io import push_notebook, show, output_notebook
from bokeh.layouts import row, gridplot
from bokeh.plotting import figure, show, output_file
output_notebook()

import numpy as np

x = np.linspace(0, 4 * np.pi, 100)
y = np.sin(x)

TOOLS = "pan,wheel_zoom,box_zoom,reset,save,box_select"

p1 = figure(title="Legend Example", tools=TOOLS)
p1.circle(x,   y, legend="sin(x)")
p1.circle(x, 2 * y, legend="2*sin(x)", color="orange")
p1.circle(x, 3 * y, legend="3*sin(x)", color="green")
show(p1)

# In[]
import pandas as pd
import numpy as np
import matplotlib
from matplotlib import pyplot as plt

ts = pd.Series(np.random.randn(1000),
               index=pd.date_range('1/1/2000', periods=1000))
ts = ts.cumsum()
df = pd.DataFrame(np.random.randn(1000, 4), index=ts.index,
                  columns=['A', 'B', 'C', 'D'])
df = df.cumsum()
df.plot()
plt.legend(loc='best')

#%%
%matplotlib inline
import matplotlib.pyplot as plt
import matplotlib as mpl
from IPython.core.pylabtools import print_figure
from IPython.display import Image, SVG, Math
import numpy as np


class Gaussian(object):
    """A simple object holding data sampled from a Gaussian distribution.
    """

    def __init__(self, mean=0.0, std=1, size=1000):
        self.data = np.random.normal(mean, std, size)
        self.mean = mean
        self.std = std
        self.size = size
        # For caching plots that may be expensive to compute
        self._png_data = None

    def _figure_data(self, format):
        fig, ax = plt.subplots()
        ax.hist(self.data, bins=50)
        ax.set_title(self._repr_latex_())
        ax.set_xlim(-10.0, 10.0)
        data = print_figure(fig, format)
        # We MUST close the figure, otherwise IPython's display machinery
        # will pick it up and send it as output, resulting in a double display
        plt.close(fig)
        return data

    def _repr_png_(self):
        if self._png_data is None:
            self._png_data = self._figure_data('png')
        return self._png_data

    def _repr_latex_(self):
        return r'$\mathcal{N}(\mu=%.2g, \sigma=%.2g),\ N=%d$' % (self.mean,
                                                                 self.std, self.size)
x = Gaussian(2.0, 1.0)
x

#%%
from IPython.display import Latex
Latex('''The mass-energy equivalence is described by the famous equation

$$E=mc^2$$

discovered in 1905 by Albert Einstein.
In natural units ($c$ = 1), the formula expresses the identity

\\begin{equation}
E=m
\\end{equation}''')
