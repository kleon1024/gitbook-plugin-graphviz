var Q = require('q');
var vizjs = require('viz.js');
var yaml = require('js-yaml');

// var ASSET_PATH = 'assets/images/graphviz/';

fontname = 'helvetica-bold'
graph_attr = {
    compound: true,
    fontname: fontname,
    splines: "curved",
    rankdir: "LR",
    ranksep: "1",
    nodesep: "0.3",
}
node_attr = {
    shape:"box",
    penwidth:"3",
    fontname:fontname,
    style:"filled", 
}
edge_attr = {
    penwidth:"3",
    arrowhead:"none",
    fontname:fontname,
}
main_node_attr = {
    fillcolor:"khaki1",
}
sub_node_attr = {
    fillcolor:"lightyellow1",
}
main_edge_attr = {
    color:"steelblue",
    constraint:"false",
}
sub_edge_attr = {
    color: "steelblue",
    style: "dashed",
}

function processBlock(blk) {
    var deferred = Q.defer();
    var book = this;
    var code = blk.body;

    var config = book.config.get('pluginsConfig.graphviz', {});
    if (blk.kwargs['config']) {
        config = blk.kwargs['config'];
    }

    var format = "svg";
    if (config && config.format)
        format = config.format;
    var engine = "dot";
    if (config && config.engine)
        engine = config.engine;

    var result = vizjs(code, { format: format, engine: engine})
    result = result.replace(/<svg width="(.*)" height="(.*)"/, '<svg style="max-width:$1;max-height:$2" preserveAspectRatio="xMinYMin meet"')
    result = result.replace(/xlink:href/g, 'href')
    deferred.resolve(result);
    return deferred.promise;
}

function render_attr(attr) {
    var attrs = []
    for (const [k, v] of Object.entries(attr)) {
        attrs.push(`${k}="${v}"`)
    }
    return attrs.join(' ')
}

function width(l) {
    return `${Math.floor(l/8)+1}`
}

function extract_attr(k) {
    var attrs = k.match(/\[(.*)\]/igm);
    if (attrs == null) {
        return [k.trim(), ""]
    }
    if (attrs.length > 1) {
        throw new Error("Multiple attribute groups are not allowed");
    }
    for (var i = 0; i < attrs.length; i++) {
        k = k.replace(attrs[i], '')
        attrs[i] = attrs[i].replace('[', '').replace(']', '');
    }
    return [k.trim(), attrs[0]]
}

module.exports = {
    blocks: {
        graphviz: {
            process: processBlock
        }
    },
    hooks: {
        // For all the hooks, this represent the current generator
        // [init", "finish", "finish:before", "page", "page:before"] are working.
        // page:* are marked as deprecated because it's better if plugins start using blocks instead.
        // But page and page:before will probably stay at the end (useful in some cases).

        // This is called before the book is generated
        "init": function() {
            if (!Object.keys(this.book.config.get('pluginsConfig.graphviz', {})).length) {
                this.book.config.set('pluginsConfig.graphviz', {
                    format: 'svg'
                });
            }
        },

        // This is called after the book generation
        "finish": function() {
            // Done
        },

        // Before the end of book generation
        "finish:before": function() {
            // Nothing to do
        },

        // The following hooks are called for each page of the book
        // and can be used to change page content (html, data or markdown)

        // Before parsing documents
        "page:before": function(page) {
            // Get all code texts
            umls = page.content.match(/^```dot((.*[\r\n]+)+?)?```$/igm);
            // Begin replace
            if (umls instanceof Array) {
                for (var i = 0, len = umls.length; i < len; i++) {
                    page.content = page.content.replace(
                        umls[i],
                        umls[i].replace(/^```dot/, '{% graphviz %}').replace(/```$/, '{% endgraphviz %}'));
                }
            }
            // Get all code texts
            umls = page.content.match(/^```graphviz((.*[\r\n]+)+?)?```$/igm);
            // Begin replace
            if (umls instanceof Array) {
                for (var i = 0, len = umls.length; i < len; i++) {
                    page.content = page.content.replace(
                        umls[i],
                        umls[i].replace(/^```graphviz/, '{% graphviz %}').replace(/```$/, '{% endgraphviz %}'));
                }
            }
            // Get all code texts
            umls = page.content.match(/^```roadmap((.*[\r\n]+)+?)?```$/igm);
            // Begin replace
            if (umls instanceof Array) {
                for (var i = 0, len = umls.length; i < len; i++) {
                    s = umls[i].replace(/^```roadmap/, '').replace(/```$/, '')
                    d = yaml.load(s);
                    g = 'digraph G {\n'
                    g += `graph [${render_attr(graph_attr)}]\n`
                    g += `node [${render_attr(node_attr)}]\n`
                    g += `edge [${render_attr(edge_attr)}]\n`
                    g += 's1,s2,e1,e2,start,end [style=invis]\n'
                    node_cnt = 0;
                    sub_node_cnt = 0;
                    for (const [k, v] of Object.entries(d)) {
                        ret = extract_attr(k);
                        nk = ret[0]
                        attr = ret[1]
                        g += `mn${node_cnt} [label="${nk}" width=${width(nk.length)} ${render_attr(main_node_attr)} ${attr}]\n`
                        if (node_cnt > 0) {
                        g += `mn${node_cnt}->mn${node_cnt-1} [${render_attr(main_edge_attr)}]\n`
                        }
                        maxl = Math.max(...v.map(x => {
                            ret = extract_attr(x);
                            return ret[0].length
                        }));
                        v.forEach((n, i)=>{
                            ret = extract_attr(n);
                            nn = ret[0]
                            attr = ret[1]
                            g += `sn${sub_node_cnt} [label="${nn}" width=${width(maxl)} ${render_attr(sub_node_attr)} ${attr}]\n`
                            if (i < Math.floor(v.length/2)) {
                                g += `sn${sub_node_cnt}:e->mn${node_cnt}:w [${render_attr(sub_edge_attr)}]\n`
                            } else {
                                g += `mn${node_cnt}:e->sn${sub_node_cnt}:w [${render_attr(sub_edge_attr)}]\n`
                            }
                            sub_node_cnt += 1
                        });
                        node_cnt += 1
                    }
                    g += 's1->start->s2 [style=invis]\n'
                    g += 'e1->end->e2 [style=invis]\n'
                    g += `mn0->start [${render_attr(sub_edge_attr)} constraint=false]\n`
                    g += `end->mn${Object.keys(d).length-1} [${render_attr(sub_edge_attr)} constraint=false]\n`
                    g += '}\n';
                    page.content = page.content.replace(
                        umls[i],
                        `{% graphviz %}\n ${g} {% endgraphviz %}\n`,
                    );
                }
            }
            return page;
        }
    }
};
