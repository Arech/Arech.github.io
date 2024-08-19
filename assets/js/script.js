(function ($) {
    // modified from
    // https://github.com/pages-themes/time-machine/blob/1c43d11ff7154d7efc91b3e55591d63ae9438757/assets/js/script.js
    $(document).ready(function () {
        // putting lines by the pre blocks
        $("pre").each(function () {
            var pre = $(this).text().split("\n");
            var lines = new Array(pre.length + 1);
            for (var i = 0; i < pre.length; i++) {
                var wrap = Math.floor(pre[i].split("").length / 81)
                if (pre[i] == "" && i == pre.length - 1) {
                    lines.splice(i, 1);
                } else {
                    lines[i] = i + 1;
                    for (var j = 0; j < wrap; j++) {
                        lines[i] += "\n";
                    }
                }
            }
            $(this).before("<pre class='lines'>" + lines.join("\n") + "</pre>");
        });
    });
})(jQuery)