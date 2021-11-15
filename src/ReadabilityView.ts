import * as fs from 'fs';
import {
  CancellationToken,
  Uri,
  Webview,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from "vscode";
import {
  CommentReadability,
  CommentType,
  ReadabilityAverages,
  ReadabilityCounts,
  ReadabilityScores
} from "./CommentReadability";

enum ReadabilityStat {
  Averages = 0,
  Counts,
  Scores,
  Types
}

const ReadabilityStatMap = new Map<ReadabilityStat, string[]>(
  [
    [ReadabilityStat.Averages, ReadabilityAverages],
    [ReadabilityStat.Counts, ReadabilityCounts],
    [ReadabilityStat.Scores, ReadabilityScores]
  ]
);
interface ReadabilityChartsConfig {
  types: any,
  counts: any,
  averages: any,
  scores: any
}

interface ChartFunc { (attrs: string[], stat: string, options: any): any[] }

export class ReadabilityViewProvider implements WebviewViewProvider {
  public static readonly viewType = "textinfo.readabilityView";
  private _webviewView?: WebviewView;

  constructor(private readonly _extensionUri: Uri, private readonly _readability: CommentReadability) { }

  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    _token: CancellationToken
  ) {
    this._webviewView = webviewView;

    // Allow scripts in the webview
    webviewView.webview.options = {
      enableScripts: true,
    };

    // Sets up an event listener to listen for messages passed from the webview view context
    // and executes code based on the message that is recieved
    // this._setWebviewMessageListener(webviewView);
  }

  public updateWebView() {
    if (!this._webviewView) {
      return;
    }

    // Set the HTML content that will fill the webview view
    this._webviewView.webview.html = this._getWebviewContent(this._webviewView.webview, this._extensionUri);
  }

  private _makeCanvasJSSeriesConfig(type: string, dataPoints: any[], options: {} = {}): any[] {
    return [{
      type: type,
      dataPoints: dataPoints,
      ...options
    }];
  }

  // Logic specific to a pie chart. We're using this just for types right now.
  private _makePieTypesConfig(attrs?: string[], stat?: string, options: {} = {}): any[] {
    let types = this._readability.comments
      .reduce((map, comment) =>
        map.set(comment.type, (map.get(comment.type) ?? 0) + 1),
        new Map<CommentType, number>());

    let total = Array.from(types.entries()).reduce((acc, [type, value]) => acc + value, 0);

    let dataPoints = Array.from(types.entries())
      .map(function ([type, count]) {
        return {
          label: CommentType[type],
          y: (count / total) * 100
        };
      });

    let baseOptions = {
      startAngle: 240,
      yValueFormatString: "##0\"%\"",
      indexLabel: "{label} {y}",
      ...options
    }

    return this._makeCanvasJSSeriesConfig('pie', dataPoints, baseOptions)
  }

  // Calculating the median for a boxplot
  private _findMedian(values: number[], begin: number, end: number): number {
    let count = end - begin;

    let halfCount:number = Math.floor(count / 2);

    if (count % 2 === 1) {
      return values[(halfCount) + begin];
    } else {
      let right = values[(halfCount + begin)];
      let left = values[(halfCount - 1 + begin)];
      return (right + left) / 2.0;
    }
  }

  private _calculateBoxplotValues(values?: number[]): number[] {
    if (!values || values.length == 0) {
      return [];
    }

    values = values.sort((n1, n2) => n1 - n2);

    let count = values.length;

    if (count == 0) {
      return [];
    } else if (count == 1) {
      return Array(5).fill(values[0]);
    }

    // Calculate limits
    let median = this._findMedian(values, 0, count);
    let lowerQuartile = this._findMedian(values, 0, Math.floor(count / 2));
    let upperQuartile = this._findMedian(values, Math.floor(count / 2) + (count % 2), count);
    let IQR = Math.abs(upperQuartile - lowerQuartile);
    let lowerExtreme = lowerQuartile - 1.5 * IQR;
    let upperExtreme = upperQuartile + 1.5 * IQR;

    return [lowerExtreme, lowerQuartile, upperQuartile, upperExtreme, median];
  }

  // Logic specific to boxplots.
  private _makeBoxplotConfig(attrs: string[], stat: string, options: {} = {}): any[] {
    let dataPoints = attrs.map((attr, index) => ({
      x: index,
      label: attr,
      y: this._calculateBoxplotValues(this._readability.comments.map(value => value.stats[stat].get(attr) ?? 0))
    }));

    return this._makeCanvasJSSeriesConfig('boxAndWhisker', dataPoints, options)
  }

  // Logic specific to multi-series scatter if we want.
  private _makeScatterConfig(attrs: string[], stat: string, options: {} = {}) {
    let data = this._readability.comments.map(function (value) {
      return {
        type: "scatter",
        dataPoints: attrs.map(function (attr) {
          return {
            label: attr,
            y: value.stats[stat].get(attr)
          };
        }),
        ...options
      };
    });

    return data;
  }

  // Create the config JSON to use
  private _createChartsConfig(): ReadabilityChartsConfig | undefined {
    let chartsConfig: ReadabilityChartsConfig = {
      counts: {},
      averages: {},
      scores: {},
      types: {}
    };

    if (!this._readability.comments.length) {
      return undefined;
    }

    let fn: ChartFunc = this._makeBoxplotConfig;

    chartsConfig.types = this._makeCanvasJSConfig(ReadabilityStat.Types, this._makePieTypesConfig);
    chartsConfig.scores = this._makeCanvasJSConfig(ReadabilityStat.Scores, fn);
    chartsConfig.averages = this._makeCanvasJSConfig(ReadabilityStat.Averages, fn);
    chartsConfig.counts = this._makeCanvasJSConfig(ReadabilityStat.Counts, fn);

    return chartsConfig;
  }

  private _makeCanvasJSConfig(stat: ReadabilityStat, callback: ChartFunc, options?: {}) {
    let title = ReadabilityStat[stat];
    let attrs = ReadabilityStatMap.get(stat) ?? [];

    // Ignoring title for now. A little too large.
    let ret = {
      // title: {
      //   text: title
      // },
      legend: {
        cursor: "pointer",
        itemclick: 'toggleDataSeries'
      },
      theme: 'dark1',
      data: callback.bind(this)(attrs, title.toLowerCase(), options)
    };

    return ret;
  }

  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    const toolkitUri = getUri(webview, extensionUri, [
      "node_modules",
      "@vscode",
      "webview-ui-toolkit",
      "dist",
      "toolkit.js",
    ]);

    const canvasJSUri = getUri(webview, extensionUri, ['media', 'canvasjs.min.js'])

    let chartsConfig = this._createChartsConfig();

    if (!chartsConfig) {
      return `
      <!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Comment Stats</title>
				</head>
				<body>
        <p>No comments found. Please open a file that contains a supported comment type.</p>
        </body>
        </html>`;
    }

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="${canvasJSUri}"></script>
					<script type="module" src="${toolkitUri}"></script>
          <style>.chart-view { min-height: 80vh; min-width: 80vw; height: 100%; width: 100%; }</style>
					<title>Comment Stats</title>
				</head>
				<body>
        <section class="main">
          <section>
          <vscode-panels aria-label="Default">
            <vscode-panel-tab id="tab-1">COUNTS</vscode-panel-tab>
            <vscode-panel-tab id="tab-2">AVERAGES</vscode-panel-tab>
            <vscode-panel-tab id="tab-3">TYPES</vscode-panel-tab>
            <vscode-panel-tab id="tab-4">SCORES</vscode-panel-tab>
            <vscode-panel-view id="view-1">
              <div id="counts-chart" class="chart-view"></div>
            </vscode-panel-view>
            <vscode-panel-view id="view-2">
              <div id="averages-chart" class="chart-view"></div>
            </vscode-panel-view>
            <vscode-panel-view id="view-3">
              <div id="types-chart" class="chart-view"></div>
            </vscode-panel-view>
            <vscode-panel-view id="view-4">
              <div id="scores-chart" class="chart-view"></div>
            </vscode-panel-view>
          </vscode-panels>
          </section>
          </section>
          <script type="text/javascript">
            (function() {
              let countsChart = new CanvasJS.Chart("counts-chart", ${JSON.stringify(chartsConfig.counts)});
              countsChart.render();
              document.getElementById('tab-1').addEventListener('click', function(ev) { 
                setTimeout(() => { countsChart.render(), 0}); 
              });

              let averagesChart = new CanvasJS.Chart("averages-chart", ${JSON.stringify(chartsConfig.averages)});
              averagesChart.render();
              document.getElementById('tab-2').addEventListener('click', function(ev) { 
                setTimeout(() => { averagesChart.render(), 0}); 
              });

              let typesChart = new CanvasJS.Chart("types-chart", ${JSON.stringify(chartsConfig.types)});
              typesChart.render();
              document.getElementById('tab-3').addEventListener('click', function(ev) { 
                setTimeout(() => { scotypesChartresChart.render(), 0}); 
              });

              let scoresChart = new CanvasJS.Chart("scores-chart", ${JSON.stringify(chartsConfig.scores)});
              scoresChart.render();
              document.getElementById('tab-4').addEventListener('click', function(ev) { 
                setTimeout(() => { scoresChart.render(), 0}); 
              });

              function toggleDataSeries(e) {
                if (typeof (e.dataSeries.visible) === "undefined" || e.dataSeries.visible) {
                  e.dataSeries.visible = false;
                } else {
                  e.dataSeries.visible = true;
                }
                e.chart.render();
              }
            })();
          </script>
				</body>
			</html>
		`;
  }
}

export function getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
  return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}