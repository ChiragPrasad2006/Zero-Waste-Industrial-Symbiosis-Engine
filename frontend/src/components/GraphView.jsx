import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function GraphView({ data }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !data?.nodes?.length) {
      return undefined;
    }

    const width = ref.current.clientWidth || 720;
    const height = 340;
    const svg = d3.select(ref.current).html('').append('svg').attr('viewBox', `0 0 ${width} ${height}`);

    svg.append('defs')
      .append('filter')
      .attr('id', 'glow')
      .append('feGaussianBlur')
      .attr('stdDeviation', 3)
      .attr('result', 'coloredBlur');

    const simulation = d3
      .forceSimulation(data.nodes.map((node) => ({ ...node })))
      .force('link', d3.forceLink(data.links).id((d) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg
      .append('g')
      .selectAll('line')
      .data(data.links)
      .enter()
      .append('line')
      .attr('stroke', '#3ac26b')
      .attr('stroke-opacity', 0.55)
      .attr('stroke-width', (d) => Math.max(1.5, (d.value || 10) / 30))
      .style('filter', 'url(#glow)');

    const node = svg
      .append('g')
      .selectAll('circle')
      .data(simulation.nodes())
      .enter()
      .append('circle')
      .attr('r', (d) => Math.max(12, d.score / 3))
      .attr('fill', '#0e8a44')
      .attr('stroke', '#f4fff6')
      .attr('stroke-width', 2)
      .style('filter', 'url(#glow)')
      .call(
        d3
          .drag()
          .on('start', (event) => {
            if (!event.active) {
              simulation.alphaTarget(0.2).restart();
            }
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          })
          .on('drag', (event) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
          })
          .on('end', (event) => {
            if (!event.active) {
              simulation.alphaTarget(0);
            }
            event.subject.fx = null;
            event.subject.fy = null;
          })
      );

    const label = svg
      .append('g')
      .selectAll('text')
      .data(simulation.nodes())
      .enter()
      .append('text')
      .text((d) => d.label)
      .attr('fill', '#154d2a')
      .attr('font-size', 11)
      .attr('font-weight', 700)
      .attr('text-anchor', 'middle');

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);

      node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
      label.attr('x', (d) => d.x).attr('y', (d) => d.y + 4);
    });

    return () => simulation.stop();
  }, [data]);

  return <div className="graph-shell" ref={ref} />;
}

